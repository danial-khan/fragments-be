const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  recipient: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  triggerUser: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  fragment: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fragment' 
  },
  reply: { 
    type: Schema.Types.ObjectId 
  }, // Embedded reply snippet for performance
  notificationType: {
    type: String,
    enum: [
      'NEW_FRAGMENT',       // Author you follow published something
      'FRAGMENT_UPDATE',    // Fragment you subscribed to was edited
      'NEW_REPLY',          // Someone replied to your content
      'REPLY_TO_REPLY',     // Someone replied to your reply
      'LIKE_FRAGMENT',      // Your fragment got liked
      'DISLIKE_FRAGMENT',   // Your fragment got disliked
      'LIKE_REPLY',         // Your reply got liked
      'DISLIKE_REPLY',      // Your reply got disliked
      'MENTION'            // You were @mentioned
    ],
    required: true
  },
  isRead: { 
    type: Boolean, 
    default: false 
  },
  // Contextual data to avoid excessive population
  contentPreview: {
    fragmentTitle: String,
    replyText: String,
    triggerUserUsername: String
  }
}, { 
  timestamps: true,
  // Auto-expire notifications after 30 days
  expires: 2592000 // Seconds (30 days)
});

// Optimized indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ fragment: 1 });
notificationSchema.index({ triggerUser: 1 });

// Middleware to add contextual data before save
notificationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.contentPreview = {
      fragmentTitle: this.fragment?.title?.substring(0, 60),
      replyText: this.reply?.content?.substring(0, 120),
      triggerUserUsername: this.triggerUser.username
    };
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

// Helper for author publish notifications
Notification.createAuthorPublishAlert = async (newFragment) => {
  const author = await mongoose.model('User').findById(newFragment.author);
  
  // Get all followers (from User schema's followers array)
  const followers = await mongoose.model('User').find({
    _id: { $in: author.followers }
  }).select('_id');
  
  const notifications = followers.map(follower => ({
    recipient: follower._id,
    triggerUser: author._id,
    fragment: newFragment._id,
    notificationType: 'NEW_FRAGMENT',
    contentPreview: {
      fragmentTitle: newFragment.title.substring(0, 60)
    }
  }));
  
  await Notification.insertMany(notifications);
};

module.exports = Notification;