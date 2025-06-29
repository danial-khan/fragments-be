const mongoose = require("mongoose");
const userCredentialsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: String,
    credentials: String,
    institution: String,
    expertise: String,
    bio: String,
    type: {
      type: String,
      enum: ["student", "author"],
    },
    file: {
      type: String,
    },
    status: {
      type: String,
      enum: ["approved", "rejected", "pending"],
      default: "pending",
    },
  },
  { timestamps: true }
);
const UserCredentialsModel = mongoose.model(
  "userCredentials",
  userCredentialsSchema
);
module.exports = UserCredentialsModel;
