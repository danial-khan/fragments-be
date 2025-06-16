const mongoose = require('mongoose');
const { Schema } = mongoose;

// Reply sub-schema for nested replies
const replySchema = new Schema({
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  upvotes: [String],
  downvotes: [String],
  replies: [this], // This allows for nested replies
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Fragment main schema
const fragmentSchema = new Schema({
  title: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  description: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  upvotes: [String],
  downvotes: [String],
  replies: [replySchema], // Embedded replies
  tags: [{ type: String }],
  isDeleted: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'published', 'blocked'], default: 'draft' },
  subscribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  subscriptionCount: { type: Number, default: 0 } // Denormalized count for performance
}, { timestamps: true });

// Virtual for vote count difference (upvotes - downvotes)
fragmentSchema.virtual('voteScore').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Virtual for reply count (including nested replies)
fragmentSchema.virtual('totalReplies').get(function() {
  let count = 0;
  
  const countReplies = (replies) => {
    count += replies.length;
    replies.forEach(reply => {
      if (reply.replies && reply.replies.length > 0) {
        countReplies(reply.replies);
      }
    });
  };
  
  countReplies(this.replies);
  return count;
});

// Add the same virtuals to the reply schema
replySchema.virtual('voteScore').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Middleware to update subscriptionCount when subscribers change
fragmentSchema.pre('save', function(next) {
  if (this.isModified('subscribers')) {
    this.subscriptionCount = this.subscribers.length;
  }
  next();
});

// Indexes for better performance
fragmentSchema.index({ title: 'text', description: 'text', content: 'text' });
fragmentSchema.index({ createdAt: -1 });
fragmentSchema.index({ 'upvotes.length': -1 });
fragmentSchema.index({ author: 1 });
fragmentSchema.index({ subscriptionCount: -1 }); // For popular fragments by subscribers

const Fragment = mongoose.model('Fragment', fragmentSchema);

module.exports = Fragment;