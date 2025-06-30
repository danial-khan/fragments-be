const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,

    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

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
      public_id: String,
      url: String,
    },

    cover: {
      public_id: String,
      url: String,
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

    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    socialLinks: {
      twitter: String,
      github: String,
      linkedin: String,
      instagram: String,
    },

    location: {
      country: String,
      state: String,
      city: String,
    },

    website: {
      type: String,
      trim: true,
    },

    showStats: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;