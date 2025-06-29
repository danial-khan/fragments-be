const mongoose = require('mongoose');
const { Schema } = mongoose;

const trailSchema = new Schema({
  authorId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  fragmentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fragment', 
    required: true 
  },
  trailId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fragment', 
    required: true 
  },
  suggestedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

// Indexes for better query performance
trailSchema.index({ fragmentId: 1 });
trailSchema.index({ authorId: 1 });
trailSchema.index({ status: 1 });
trailSchema.index({ suggestedBy: 1 });

const Trail = mongoose.model('Trail', trailSchema);

module.exports = Trail; 