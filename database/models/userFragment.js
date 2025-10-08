const mongoose = require('mongoose');
const { Schema } = mongoose;

const userFragmentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fragmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Fragment',
      required: true
    },
    score: {
      type: Number,
      default: 0,
      required: true
    },
    reason: {
      type: String,
      enum: [
        'category_match',
        'title_similarity',
        'location_based',
        'device_based',
        'popular',
        'trending',
        'ai_recommended'
      ],
      required: true
    },
    metadata: {
      categoryScore: { type: Number, default: 0 },
      titleSimilarityScore: { type: Number, default: 0 },
      locationScore: { type: Number, default: 0 },
      deviceScore: { type: Number, default: 0 },
      aiExplanation: { type: String, default: '' },
      lastCalculated: { type: Date, default: Date.now }
    },
    isViewed: {
      type: Boolean,
      default: false
    },
    isClicked: {
      type: Boolean,
      default: false
    },
    lastRecommended: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
userFragmentSchema.index({ userId: 1, score: -1 });
userFragmentSchema.index({ userId: 1, isViewed: 1 });
userFragmentSchema.index({ userId: 1, lastRecommended: -1 });

// Ensure unique combination of userId and fragmentId
userFragmentSchema.index({ userId: 1, fragmentId: 1 }, { unique: true });

const UserFragment = mongoose.model('UserFragment', userFragmentSchema);

module.exports = UserFragment; 