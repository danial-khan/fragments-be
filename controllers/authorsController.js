const mongoose = require("mongoose");
const UserModel = require("../database/models/user");
const UserCredentialsModel = require("../database/models/userCredentials");

const authorsController = {
  getAuthors: async (req, res) => {
    try {
      const { search } = req.query;

      const matchStage = {
        type: "author",
        active: true,
      };

      if (search) {
        matchStage.name = { $regex: search, $options: "i" };
      }

      const authors = await UserModel.aggregate([
        {
          $match: matchStage,
        },
        {
          $lookup: {
            from: "usercredentials",
            localField: "_id",
            foreignField: "userId",
            as: "credentials",
          },
        },
        {
          $unwind: {
            path: "$credentials",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            avatar: 1,
            type: 1,
            createdAt: 1,
            credentials: {
              name: "$credentials.name",
              institution: "$credentials.institution",
              expertise: "$credentials.expertise",
              bio: "$credentials.bio",
              file: "$credentials.file",
              status: "$credentials.status",
            },
            followers: 1,
          },
        },
      ]);

      return res.status(200).json({ authors });
    } catch (error) {
      console.error("Error in getAuthors:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  },

  followAuthor: async (req, res) => {
    const currentUserId = req.user._id;
    const authorId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return res.status(400).json({ message: "Invalid author ID" });
    }

    if (currentUserId === authorId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    try {
      const user = await UserModel.findById(currentUserId);
      const author = await UserModel.findById(authorId);

      if (!author || author.type !== "author") {
        return res.status(404).json({ message: "Author not found" });
      }

      const isFollowing = user.following.includes(authorId);

      if (isFollowing) {
        // Unfollow
        user.following.pull(authorId);
        author.followers.pull(currentUserId);
      } else {
        // Follow
        user.following.push(authorId);
        author.followers.push(currentUserId);
      }

      await user.save();
      await author.save();

      return res.status(200).json({
        message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
        isFollowing: !isFollowing,
      });
    } catch (error) {
      console.error("Follow author error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  },
};

module.exports = authorsController;
