const mongoose = require("mongoose");
const userCredentialsSchema = new mongoose.Schema(
  {
    userId: mongoose.Types.ObjectId,
    name: String,
    credentials: String,
    institution: String,
    expertise: String,
    bio: String,
    type: {
      type: String,
      enum: ['student', 'author']
    },
    file: {
      type: String,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
const UserCredentialsModel = mongoose.model("userCredentials", userCredentialsSchema);
module.exports = UserCredentialsModel;
