const mongoose = require("mongoose");
const UserModel = require("../database/models/user");
const UserCredentialsModel = require("../database/models/userCredentials");
const { errorResponse, serverError } = require("../utils/response");

const authorsController = {
  getAuthors: async (req, res) => {
    try {
      const { search } = req.query;
      const currentUserId = req.user?._id;

      const matchStage = { type: "author", active: true };
      if (currentUserId) {
        matchStage._id = { $ne: currentUserId };
      }

      if (search) {
        matchStage.name = { $regex: search, $options: "i" };
      }

      const authors = await UserModel.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "usercredentials",
            localField: "_id",
            foreignField: "userId",
            as: "credentials",
          },
        },
        {
          $unwind: { path: "$credentials", preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            username: 1,
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
      console.error("Get authors error:", error);
      return serverError(res);
    }
  },

  followAuthor: async (req, res) => {
    const currentUserId = req.user._id;
    const { id: authorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return errorResponse(res, 400, "Invalid author ID.", "VALIDATION_ERROR");
    }

    if (currentUserId.equals(authorId)) {
      return errorResponse(res, 400, "You cannot follow yourself.", "VALIDATION_ERROR");
    }

    try {
      const user = await UserModel.findById(currentUserId);
      const author = await UserModel.findById(authorId);

      if (!author || author.type !== "author") {
        return errorResponse(res, 404, "Author not found.", "NOT_FOUND");
      }

      const isFollowing = user.following.includes(authorId);

      if (isFollowing) {
        user.following.pull(authorId);
        author.followers.pull(currentUserId);
      } else {
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
      return serverError(res);
    }
  },
};

module.exports = authorsController;
