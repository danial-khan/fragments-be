const mongoose = require("mongoose");
const FragmentModel = require("../database/models/fragment");
const UserModel = require("../database/models/user");
const UserCredentialsModel = require("../database/models/userCredentials");
const CategoryModel = require("../database/models/category");
const notificationController = require("./notificationController");
const { analyzeContentWithAI } = require("../utils/aiReview");
const { errorResponse, serverError } = require("../utils/response");

async function pruneAndPopulate(replies = []) {
  const valid = replies.filter(
    (r) => r.isDeleted === false
  );
  if (valid.length === 0) return [];

  await FragmentModel.populate(valid, {
    path: "author",
    select: "name username avatar",
  });

  return Promise.all(
    valid.map(async (r) => {
      const children = Array.isArray(r.replies) ? r.replies : [];
      const prunedKids = await pruneAndPopulate(children);

      return {
        _id: r._id,
        content: r.content,
        author: r.author,
        upvotes: r.upvotes,
        downvotes: r.downvotes,
        aiReviewStatus: r.aiReviewStatus,
        aiReviewFeedback: r.aiReviewFeedback,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        replies: prunedKids,
      };
    })
  );
}

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

      const textToModerate = `${title}\n${description}\n${content}`;

      const categoryExists = await CategoryModel.findById(category);
      if (!categoryExists) {
        return errorResponse(res, 400, "Invalid category.", "VALIDATION_ERROR");
      }

      const {
        status: aiReviewStatus,
        feedback: aiReviewFeedback,
        summary: aiReviewSummary,
      } = await analyzeContentWithAI(textToModerate, "fragments");

      let finalStatus = status;
      if (aiReviewStatus === "rejected") {
        finalStatus = "blocked";
      }

      const newFragment = new FragmentModel({
        title,
        category,
        description,
        content,
        author,
        status: finalStatus,
        subscribers: [author],
        aiReviewStatus,
        aiReviewFeedback,
        aiReviewSummary,
      });

      const savedFragment = await newFragment.save();

      // Notify only if published
      if (finalStatus === "published") {
        await notificationController.triggerNewFragmentNotification(
          savedFragment._id
        );
      }

      return res.status(201).json({
        message:
          finalStatus === "blocked"
            ? "Fragment saved but blocked due to content policy violation."
            : "Fragment created successfully.",
        fragment: savedFragment,
        aiBlocked: finalStatus === "blocked",
        feedback: aiReviewSummary,
      });
    } catch (err) {
      console.error("Create fragment error:", err);
      return serverError(res);
    }
  },

  getFragment: async (req, res) => {
    try {
      let fragment = await FragmentModel.findOne({
        _id: req.params.id,
        isDeleted: false,
        status: "published",
      })
        .populate("author", "name username email avatar")
        .populate("category", "name color");

      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }

      fragment = fragment.toObject();
      fragment.replies = await pruneAndPopulate(fragment.replies);

      await FragmentModel.updateOne(
        { _id: fragment._id },
        { $inc: { viewCount: 1 } }
      );

      // Update recommendation interaction if user is authenticated
      if (req.user && req.user._id) {
        const recommendationJobService = require('../services/recommendationJob');
        recommendationJobService.updateUserInteraction(req.user._id, fragment._id, 'view');
      }

      res.status(200).json(fragment);
    } catch (err) {
      console.error("getFragment error:", err);
      serverError(res);
    }
  },

  // Get all fragments with pagination and filtering
  getFragments: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 9,
        category,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
        idne,
      } = req.query;

      const query = { isDeleted: false, status: "published" };
      if (idne) {
        query._id = { $ne: idne };
      }

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
        .populate("author", "name username")
        .populate("category", "name color");

      const total = await FragmentModel.countDocuments(query);

      res.status(200).json({
        fragments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error("Get fragments error:", err);
      serverError(res);
    }
  },

  getPublicProfile: async (req, res) => {
    try {
      const { username } = req.params;
      const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limNum = Math.max(1, parseInt(req.query.limit, 10) || 10);

      const user = await UserModel.findOne({ username, isDeleted: false })
        .select(
          "_id name username avatar cover type location socialLinks website followers following createdAt showStats"
        )
        .lean();
      if (!user) {
        return errorResponse(res, 404, "User not found.", "NOT_FOUND");
      }

      const credentials = await UserCredentialsModel.findOne({
        userId: user._id,
        isDeleted: false,
        status: "approved",
      })
        .select("bio credentials institution expertise type")
        .lean();

      const fragFilter = {
        author: user._id,
        isDeleted: false,
        status: "published",
      };
      const totalFragments = await FragmentModel.countDocuments(fragFilter);

      const fragments = await FragmentModel.find(fragFilter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limNum)
        .limit(limNum)
        .populate("category", "name color")
        .lean();

      let stats = null;
      if (user.showStats) {
        const statsFrags = await FragmentModel.find(fragFilter)
          .select("upvotes viewCount")
          .lean();

        const { totalUpvotes, totalViews } = statsFrags.reduce(
          (acc, f) => {
            acc.totalUpvotes += Array.isArray(f.upvotes) ? f.upvotes.length : 0;
            acc.totalViews += typeof f.viewCount === "number" ? f.viewCount : 0;
            return acc;
          },
          { totalUpvotes: 0, totalViews: 0 }
        );

        stats = {
          totalUpvotes,
          totalViews,
          totalEarnings: totalViews * 0.0001,
        };
      }

      return res.json({
        user,
        credentials,
        fragments,
        totalFragments,
        page: pageNum,
        pages: Math.ceil(totalFragments / limNum),
        ...(stats || {}),
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return serverError(res);
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
        .populate("author", "name username")
        .populate("category", "name color");

      const total = await FragmentModel.countDocuments(query);

      res.status(200).json({
        fragments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error("Get fragments error:", err);
      serverError(res);
    }
  },

  getUserFragmentsStats: async (req, res) => {
    try {
      const userId = req.user._id;

      const fragments = await FragmentModel.find({
        author: userId,
        isDeleted: false,
        status: "published",
      })
        .populate("author", "name username")
        .populate("category", "name color");

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
      serverError(res);
    }
  },

  // Update a fragment
  updateFragment: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, description, content, status } = req.body;
      const userId = req.user._id;

      const fragment = await FragmentModel.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }

      if (fragment.author.toString() !== userId.toString()) {
        return errorResponse(res, 403, "You are not authorized to update this fragment.", "FORBIDDEN");
      }

      if (category) {
        const categoryExists = await CategoryModel.findById(category);
        if (!categoryExists) {
          return errorResponse(res, 400, "Invalid category.", "VALIDATION_ERROR");
        }
      }

      const finalTitle = title || fragment.title || "";
      const finalDescription = description || fragment.description || "";
      const finalContent = content || fragment.content || "";

      const textToModerate = [finalTitle, finalDescription, finalContent]
        .filter(Boolean)
        .join("\n");

      const {
        status: aiReviewStatus,
        feedback: aiReviewFeedback,
        summary: aiReviewSummary,
      } = await analyzeContentWithAI(textToModerate, "fragments");

      let finalStatus;

      if (aiReviewStatus === "rejected") {
        finalStatus = "blocked";
      } else if (aiReviewStatus === "approved") {
        finalStatus = "published";
      } else {
        finalStatus = fragment.status;
      }

      const wasPublished = fragment.status === "published";

      const updatedFragment = await FragmentModel.findByIdAndUpdate(
        id,
        {
          title: title || fragment.title,
          category: category || fragment.category,
          description: description || fragment.description,
          content: content || fragment.content,
          status: finalStatus,
          aiReviewStatus,
          aiReviewFeedback,
          aiReviewSummary,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!wasPublished && status === "published") {
        await notificationController.triggerNewFragmentNotification(id);
      } else if (wasPublished && (title || content || description)) {
        await notificationController.triggerFragmentUpdatedNotification(id);
      }

      return res.status(200).json({
        message:
          finalStatus === "blocked"
            ? "Fragment saved but blocked due to content policy violation."
            : "Fragment updated successfully.",
        fragment: updatedFragment,
        aiBlocked: finalStatus === "blocked",
        feedback: aiReviewSummary,
      });
    } catch (err) {
      console.error("Update fragment error:", err);
      return serverError(res);
    }
  },

  // Delete a fragment (soft delete)
  deleteFragment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const fragment = await FragmentModel.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }
      // Check if the user is the author
      if (fragment.author.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this fragment" });
      }

      fragment.isDeleted = true;
      fragment.status = "blocked";
      await fragment.save();

      res.status(200).json({ message: "Fragment deleted successfully" });
    } catch (err) {
      console.error("Delete fragment error:", err);
      serverError(res);
    }
  },

  addReply: async (req, res) => {
    try {
      const { id } = req.params;
      const { content, parentReplyId, isEdit } = req.body;
      const author = req.user._id;

      if (!content) {
        return errorResponse(res, 400, "Reply content is required.", "VALIDATION_ERROR");
      }

      const moderationResult = await analyzeContentWithAI(content, "reply");
      let finalStatus;

      if (moderationResult.status === "rejected") {
        finalStatus = "blocked";
      } else if (moderationResult.status === "approved") {
        finalStatus = "published";
      } else {
        finalStatus = fragment.status;
      }

      const fragment = await FragmentModel.findById(id);
      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }

      if (!fragment.subscribers.includes(author)) {
        fragment.subscribers.push(author);
        fragment.markModified("subscribers");
        await fragment.save();
      }

      if (isEdit) {
        let updatedReply = null;

        const updateReplies = (replies) => {
          for (let reply of replies) {
            if (reply._id.toString() === parentReplyId) {
              reply.content = content;
              reply.aiReviewStatus = moderationResult.status;
              reply.aiReviewFeedback = moderationResult.feedback;
              reply.aiReviewSummary = moderationResult.summary;
              reply.status = finalStatus;
              reply.updatedAt = new Date();
              updatedReply = reply;
              return true;
            }
            if (reply.replies?.length) {
              if (updateReplies(reply.replies)) return true;
            }
          }
          return false;
        };

        const found = updateReplies(fragment.replies);
        if (!found) {
          return errorResponse(res, 404, "Reply not found.", "NOT_FOUND");
        }

        fragment.markModified("replies");
        await fragment.save();

        return res.status(200).json({
          message:
            finalStatus === "blocked"
              ? "Reply saved but blocked due to content policy violation."
              : "Reply updated successfully.",
          reply: updatedReply,
          aiBlocked: finalStatus === "blocked",
        });
      }

      // Create new reply
      const newReply = {
        _id: new mongoose.Types.ObjectId(),
        content,
        author,
        upvotes: [],
        downvotes: [],
        replies: [],
        isDeleted: false,
        aiReviewStatus: moderationResult.status,
        aiReviewFeedback: moderationResult.feedback,
        aiReviewSummary: moderationResult.summary,
        status: finalStatus,
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
            if (reply.replies?.length > 0) {
              if (addReplyToParent(reply.replies, parentId)) return true;
            }
          }
          return false;
        };

        if (!addReplyToParent(fragment.replies, parentReplyId)) {
          return errorResponse(res, 404, "Parent reply not found.", "NOT_FOUND");
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

      return res.status(201).json({
        message:
          finalStatus === "blocked"
            ? "Reply saved but blocked due to content policy violation."
            : "Reply added successfully.",
        reply: newReply,
        aiBlocked: finalStatus === "blocked",
      });
    } catch (err) {
      console.error("Add reply error:", err);
      return serverError(res);
    }
  },

  deleteReply: async (req, res) => {
    try {
      const { fragmentId, replyId } = req.params;
      const userId = req.user._id;

      const fragment = await FragmentModel.findById(fragmentId);
      if (!fragment || fragment.isDeleted || fragment.status !== "published") {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }

      let unauthorized = false;
      let found = false;

      const markDeleted = (replies) => {
        for (const r of replies) {
          if (r._id.toString() === replyId) {
            if (
              r.author.toString() !== userId.toString() &&
              !req.user.isAdmin
            ) {
              unauthorized = true;
              return;
            }
            const recurse = (node) => {
              node.isDeleted = true;
              node.status = "blocked";
              for (const child of node.replies) {
                recurse(child);
              }
            };
            recurse(r);
            found = true;
            return;
          }
          if (r.replies.length) {
            markDeleted(r.replies);
            if (found || unauthorized) return;
          }
        }
      };

      markDeleted(fragment.replies);

      if (unauthorized) {
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this reply" });
      }
      if (!found) {
        return errorResponse(res, 404, "Reply not found.", "NOT_FOUND");
      }

      fragment.markModified("replies");
      await fragment.save();

      res.status(200).json({ message: "Reply and its sub‑replies deleted" });
    } catch (err) {
      console.error("Delete reply error:", err);
      serverError(res);
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
        return errorResponse(res, 400, "Invalid vote type.", "VALIDATION_ERROR");
      }

      const fragment = await FragmentModel.findById(id);
      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
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
          return errorResponse(res, 404, "Reply not found.", "NOT_FOUND");
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
      serverError(res);
    }
  },
  changeFragmentStatus: async (req, res) => {
    try {
      const { id, status } = req.params;
      const userId = req.user._id;

      if (!["draft", "published"].includes(status)) {
        return errorResponse(res, 400, "Invalid status value.", "VALIDATION_ERROR");
      }

      const fragment = await FragmentModel.findOne({
        _id: id,
        isDeleted: false,
      });
      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
      }

      if (fragment.author.toString() !== userId.toString()) {
        return errorResponse(res, 403, "You are not authorized to perform this action.", "FORBIDDEN");
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
      serverError(res);
    }
  },
};

module.exports = fragmentController;
