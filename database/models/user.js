const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    resetCode: {
      type: String,
      default: null,
    },
    verificationCode: String,
    remember: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      default: "app",
    },
    avatar: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ["student", "author", "admin", "moderator"],
      default: "student",
    },
    subscription: {
      id: String,
      plan: String,
      subscriptionDate: {
        type: Date,
        default: null,
      },
    },
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;