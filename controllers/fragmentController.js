const FragmentModel = require("../database/models/fragment");
const CategoryModel = require("../database/models/category");
const notificationController = require("./notificationController");
const mongoose = require("mongoose");

const populateAuthors = async (replies) => {
  if (!replies || !replies.length) return;

  await FragmentModel.populate(replies, {
    path: "author",
    select: "name",
  });

  for (const reply of replies) {
    if (reply.replies && reply.replies.length) {
      await populateAuthors(reply.replies);
    }
  }
};

const fragmentController = {
  // Create a new fragment
  createFragment: async (req, res) => {
    try {
      const {
        title,
        category,
        description,
        content,
        status = "draft",
      } = req.body;
      const author = req.user._id;

      const categoryExists = await CategoryModel.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ error: "Invalid category" });
      }

      const newFragment = new FragmentModel({
        title,
        category,
        description,
        content,
        author,
        status,
        subscribers: [author],
      });

      const savedFragment = await newFragment.save();

      if (status === "published") {
        await notificationController.triggerNewFragmentNotification(
          savedFragment._id
        );
      }

      res.status(201).json({
        message: "Fragment created successfully",
        fragment: savedFragment,
      });
    } catch (err) {
      console.error("Create fragment error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // Get a single fragment by ID with populated author and category
  async getFragment(req, res) {
    try {
      const fragment = await FragmentModel.findById(req.params.id)
        .populate("author", "name username email")
        .populate("category", "name");
      await populateAuthors(fragment.replies);

      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      fragment.viewCount += 1;
      await fragment.save();

      res.status(200).json(fragment);
    } catch (err) {
      console.error("Get fragment error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // Get all fragments with pagination and filtering
  getFragments: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        category,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const query = { isDeleted: false, status: "published" };

      if (category) {
        query.category = category;
      }

      if (search) {
        query.$text = { $search: search };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      const fragments = await FragmentModel.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate("author", "username")
        .populate("category", "name");

      const total = await FragmentModel.countDocuments(query);

      res.status(200).json({
        fragments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error("Get fragments error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  getUserFragments: async (req, res) => {
    try {
      const userId = req.user._id;
      const {
        page = 1,
        limit = 10,
        category,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const query = { isDeleted: false, author: userId };

      if (category) {
        query.category = category;
      }

      if (search) {
        query.$text = { $search: search };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      const fragments = await FragmentModel.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate("author", "username")
        .populate("category", "name");

      const total = await FragmentModel.countDocuments(query);

      res.status(200).json({
        fragments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error("Get fragments error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  getUserFragmentsStats: async (req, res) => {
    try {
      const userId = req.user._id;

      const fragments = await FragmentModel.find({
        author: userId,
        isDeleted: false,
      })
        .populate("author", "username")
        .populate("category", "name");

      // 0.0001$ per view
      const stats = {
        totalFragments: fragments.length,
        totalUpvotes: fragments.reduce(
          (acc, fragment) => acc + fragment.upvotes.length,
          0
        ),
        totalDownvotes: fragments.reduce(
          (acc, fragment) => acc + fragment.downvotes.length,
          0
        ),
        totalReplies: fragments.reduce(
          (acc, fragment) => acc + fragment.totalReplies,
          0
        ),
        totalViews: fragments.reduce(
          (acc, fragment) => acc + fragment.viewCount,
          0
        ),
        totalEarnings: fragments.reduce(
          (acc, fragment) => acc + fragment.viewCount * 0.0001,
          0
        ),
      };

      res.status(200).json(stats);
    } catch (err) {
      console.error("Get user fragments stats error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // Update a fragment
  updateFragment: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, description, content, status } = req.body;
      const userId = req.user._id;

      const fragment = await FragmentModel.findById(id);

      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      if (fragment.author.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this fragment" });
      }

      if (category) {
        const categoryExists = await CategoryModel.findById(category);
        if (!categoryExists) {
          return res.status(400).json({ error: "Invalid category" });
        }
      }

      const wasPublished = fragment.status === "published";
      const updatedFragment = await FragmentModel.findByIdAndUpdate(
        id,
        {
          title: title || fragment.title,
          category: category || fragment.category,
          description: description || fragment.description,
          content: content || fragment.content,
          status: status || fragment.status,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!wasPublished && status === "published") {
        await notificationController.triggerNewFragmentNotification(id);
      } else if (wasPublished && (title || content || description)) {
        await notificationController.triggerFragmentUpdatedNotification(id);
      }

      res.status(200).json({
        message: "Fragment updated successfully",
        fragment: updatedFragment,
      });
    } catch (err) {
      console.error("Update fragment error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // Delete a fragment (soft delete)
  deleteFragment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const fragment = await FragmentModel.findById(id);

      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      // Check if the user is the author
      if (fragment.author.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this fragment" });
      }

      fragment.isDeleted = true;
      await fragment.save();

      res.status(200).json({ message: "Fragment deleted successfully" });
    } catch (err) {
      console.error("Delete fragment error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  addReply: async (req, res) => {
    try {
      const { id } = req.params;
      const { content, parentReplyId, isEdit } = req.body;
      const author = req.user._id;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const fragment = await FragmentModel.findById(id);
      if (!fragment.subscribers.includes(author)) {
        fragment.subscribers.push(author);
        fragment.markModified("subscribers");
        await fragment.save();
      }
      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      if (isEdit) {
        const updateReplies = (replies) => {
          for (let reply of replies) {
            if (reply._id.toString() === parentReplyId) {
              reply.content = content;
              reply.updatedAt = new Date();
              updated = true;
            } else if (reply.replies?.length) {
              updateReplies(reply.replies);
            }
          }
        };

        updateReplies(fragment.replies);
        fragment.markModified("replies");
        await fragment.save();
      } else {
        const newReply = {
          _id: new mongoose.Types.ObjectId(),
          content,
          author,
          upvotes: [],
          downvotes: [],
          replies: [],
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        let parentReplyAuthorId = null;

        if (parentReplyId) {
          const addReplyToParent = (replies, parentId) => {
            for (let reply of replies) {
              if (reply._id.toString() === parentId.toString()) {
                reply.replies.push(newReply);
                parentReplyAuthorId = reply.author;
                return true;
              }
              if (reply.replies && reply.replies.length > 0) {
                if (addReplyToParent(reply.replies, parentId)) {
                  return true;
                }
              }
            }
            return false;
          };

          if (!addReplyToParent(fragment.replies, parentReplyId)) {
            return res.status(404).json({ error: "Parent reply not found" });
          }
        } else {
          fragment.replies.push(newReply);
        }

        fragment.markModified("replies");
        await fragment.save();

        await notificationController.triggerReplyNotification(
          newReply,
          fragment._id,
          parentReplyAuthorId
        );
      }

      res.status(201).json({ message: "Reply added successfully" });
    } catch (err) {
      console.error("Add reply error:", err);
      res.status(500).json({ error: err.message });
    }
  },
  deleteReply: async (req, res) => {
    try {
      const { fragmentId, replyId } = req.params;
      const userId = req.user._id;

      const fragment = await FragmentModel.findById(fragmentId);
      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      let deleted = false;

      // Recursive function to find and delete reply
      const deleteNestedReply = (replies) => {
        for (let i = 0; i < replies.length; i++) {
          const reply = replies[i];

          // Check if current reply matches the ID
          if (reply._id.toString() === replyId.toString()) {
            // Verify the user is the author or has admin rights
            if (
              reply.author.toString() !== userId.toString() &&
              !req.user.isAdmin
            ) {
              return "unauthorized";
            }

            // Permanently delete the reply by removing it from the array
            replies.splice(i, 1);
            return "deleted";
          }

          // Check nested replies
          if (reply.replies?.length > 0) {
            const result = deleteNestedReply(reply.replies);
            if (result === "deleted" || result === "unauthorized") {
              return result;
            }
          }
        }
        return false;
      };

      const result = deleteNestedReply(fragment.replies);

      if (result === "unauthorized") {
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this reply" });
      }

      if (!result) {
        return res.status(404).json({ error: "Reply not found" });
      }

      fragment.markModified("replies");
      await fragment.save();

      res.status(200).json({ message: "Reply deleted successfully" });
    } catch (err) {
      console.error("Delete reply error:", err);
      res.status(500).json({ error: err.message });
    }
  },

  // Vote on a fragment or reply
  vote: async (req, res) => {
    try {
      const { id } = req.params;
      const { voteType, replyId } = req.body;
      const userId = req.user._id;
      const author = userId;

      if (!["upvote", "downvote", "remove"].includes(voteType)) {
        return res.status(400).json({ error: "Invalid vote type" });
      }

      const fragment = await FragmentModel.findById(id);
      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }
      if (!fragment.subscribers.includes(author)) {
        fragment.subscribers.push(author);
        fragment.markModified("subscribers");
        await fragment.save();
      }
      let targetAuthor = null;
      let targetReply = null;

      const updateVotes = (target) => {
        target.upvotes = target.upvotes.filter(
          (id) => id.toString() !== userId.toString()
        );
        target.downvotes = target.downvotes.filter(
          (id) => id.toString() !== userId.toString()
        );

        if (voteType === "upvote") {
          target.upvotes.push(userId);
          targetAuthor = target.author;
        } else if (voteType === "downvote") {
          target.downvotes.push(userId);
          targetAuthor = target.author;
        }
      };

      if (replyId) {
        const findAndUpdateReply = (replies) => {
          for (let reply of replies) {
            if (reply._id.toString() === replyId.toString()) {
              updateVotes(reply);
              targetReply = reply;
              return true;
            }
            if (reply.replies && reply.replies.length > 0) {
              if (findAndUpdateReply(reply.replies)) {
                return true;
              }
            }
          }
          return false;
        };

        if (!findAndUpdateReply(fragment.replies)) {
          return res.status(404).json({ error: "Reply not found" });
        }
      } else {
        updateVotes(fragment);
      }

      fragment.markModified("replies");
      await fragment.save();

      if (
        voteType !== "remove" &&
        targetAuthor &&
        !targetAuthor.equals(userId)
      ) {
        if (targetReply) {
          if (voteType === "upvote") {
            await notificationController.triggerReplyLikedNotification(
              targetReply,
              fragment._id,
              userId
            );
          } else {
            await notificationController.triggerReplyDislikedNotification(
              targetReply,
              fragment._id,
              userId
            );
          }
        } else if (voteType === "upvote") {
          await notificationController.triggerFragmentLikedNotification(
            id,
            userId
          );
        } else {
          await notificationController.triggerFragmentDislikedNotification(
            id,
            userId
          );
        }
      }

      res.status(200).json({ message: "Vote updated successfully" });
    } catch (err) {
      console.error("Vote error:", err);
      res.status(500).json({ error: err.message });
    }
  },
  changeFragmentStatus: async (req, res) => {
    try {
      const { id, status } = req.params;
      const userId = req.user._id;

      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const fragment = await FragmentModel.findById(id);
      if (!fragment) {
        return res.status(404).json({ error: "Fragment not found" });
      }

      if (fragment.author.toString() !== userId.toString()) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (fragment.status === status) {
        return res.status(400).json({ error: `Fragment is already ${status}` });
      }

      fragment.status = status;
      if (status === "published") {
        fragment.publishedAt = new Date();
      }

      await fragment.save();

      if (status === "published") {
        await notificationController.triggerNewFragmentNotification(id);
      }

      res.status(200).json({
        message: `Fragment status changed to ${status} successfully`,
        fragment: {
          _id: fragment._id,
          title: fragment.title,
          status: fragment.status,
          publishedAt: fragment.publishedAt,
        },
      });
    } catch (err) {
      console.error("Change fragment status error:", err);
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = fragmentController;
