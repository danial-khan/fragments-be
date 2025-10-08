const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    // Flexible payload - can store any data structure
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Optional metadata
    eventType: {
      type: String,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    // Allow flexible schema for the payload
    strict: false,
  }
);

module.exports = mongoose.model("Event", eventSchema); 