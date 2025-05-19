const Notification = require('../database/models/notification');
const Fragment = require('../database/models/fragment');
const User = require('../database/models/user');

const notificationController = {
  getRecentActivityForUser: async (req, res) => {
    try {
      const notifications = await Notification.find({
        recipient: req.user._id,
        isRead: false
      }).populate('recipient', 'name').sort('-createdAt').limit(15).lean();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching notifications', error });
    }
  },

  getAllActivityForUser: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        Notification.find({ recipient: req.user._id }).sort('-createdAt').skip(skip).limit(limit).lean(),
        Notification.countDocuments({ recipient: req.user._id })
      ]);

      res.json({
        notifications,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching activity', error });
    }
  },

  getAuthorActivity: async (req, res) => {
    try {
      const fragmentIds = await Fragment.find({ author: req.user._id }).distinct('_id');
      const activities = await Notification.find({
        fragment: { $in: fragmentIds },
        notificationType: { $in: ['NEW_REPLY', 'REPLY_TO_REPLY', 'LIKE_FRAGMENT', 'DISLIKE_FRAGMENT', 'LIKE_REPLY', 'DISLIKE_REPLY'] }
      }).sort('-createdAt').limit(50).populate('triggerUser', 'username avatar').populate('fragment', 'title').lean();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching author activity', error });
    }
  },

  markAsRead: async (req, res) => {
    try {
      await Notification.updateMany(
        { _id: { $in: req.body.notificationIds }, recipient: req.user._id },
        { $set: { isRead: true } }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Error marking as read', error });
    }
  },

  clearAll: async (req, res) => {
    try {
      await Notification.deleteMany({ recipient: req.user._id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Error clearing notifications', error });
    }
  },

  getSubscriptionActivity: async (req, res) => {
    try {
      const user = await User.findById(req.user._id).populate('subscriptions.fragment');
      const fragmentIds = user.subscriptions.map(sub => sub.fragment._id);
      const updates = await Notification.find({
        fragment: { $in: fragmentIds },
        notificationType: { $in: ['FRAGMENT_UPDATE', 'NEW_REPLY'] }
      }).sort('-createdAt').populate('triggerUser', 'username').populate('fragment', 'title').limit(30).lean();
      res.json(updates);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching subscription activity', error });
    }
  },

  getMentions: async (req, res) => {
    try {
      const mentions = await Notification.find({
        recipient: req.user._id,
        notificationType: 'MENTION'
      }).sort('-createdAt').populate('triggerUser', 'username avatar').populate('fragment', 'title').lean();
      res.json(mentions);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching mentions', error });
    }
  }
};

notificationController.triggerNewFragmentNotification = async (fragmentId) => {
  const fragment = await Fragment.findById(fragmentId).populate('author');
  const followers = await User.find({ _id: { $in: fragment.author.followers } }).select('_id');
  const notifications = followers.map(user => ({
    recipient: user._id,
    triggerUser: fragment.author._id,
    fragment: fragment._id,
    notificationType: 'NEW_FRAGMENT',
    contentPreview: { fragmentTitle: fragment.title.substring(0, 60) }
  }));
  await Notification.insertMany(notifications);
};

notificationController.triggerFragmentUpdatedNotification = async (fragmentId) => {
  const fragment = await Fragment.findById(fragmentId);
  const subscribers = await User.find({ 'subscriptions.fragment': fragmentId }).select('_id');
  const notifications = subscribers.map(user => ({
    recipient: user._id,
    triggerUser: fragment.author,
    fragment: fragment._id,
    notificationType: 'FRAGMENT_UPDATE',
    contentPreview: { fragmentTitle: fragment.title.substring(0, 60) }
  }));
  await Notification.insertMany(notifications);
};

notificationController.triggerFragmentLikedNotification = async (fragmentId, userId) => {
  const fragment = await Fragment.findById(fragmentId);
  if (!fragment.author.equals(userId)) {
    await Notification.create({
      recipient: fragment.author,
      triggerUser: userId,
      fragment: fragment._id,
      notificationType: 'LIKE_FRAGMENT',
      contentPreview: { fragmentTitle: fragment.title.substring(0, 60) }
    });
  }
};

notificationController.triggerFragmentDislikedNotification = async (fragmentId, userId) => {
  const fragment = await Fragment.findById(fragmentId);
  if (!fragment.author.equals(userId)) {
    await Notification.create({
      recipient: fragment.author,
      triggerUser: userId,
      fragment: fragment._id,
      notificationType: 'DISLIKE_FRAGMENT',
      contentPreview: { fragmentTitle: fragment.title.substring(0, 60) }
    });
  }
};

notificationController.triggerReplyNotification = async (reply, fragmentId, parentReplyAuthorId = null) => {
  const fragment = await Fragment.findById(fragmentId);
  const recipients = new Set();
  if (!fragment.author.equals(reply.author)) recipients.add(fragment.author.toString());
  if (parentReplyAuthorId && !parentReplyAuthorId.equals(reply.author)) recipients.add(parentReplyAuthorId.toString());
  const notifications = Array.from(recipients).map(recipientId => ({
    recipient: recipientId,
    triggerUser: reply.author,
    fragment: fragmentId,
    reply: reply._id,
    notificationType: parentReplyAuthorId ? 'REPLY_TO_REPLY' : 'NEW_REPLY',
    contentPreview: { replyText: reply.content.substring(0, 120) }
  }));
  await Notification.insertMany(notifications);
};

notificationController.triggerReplyLikedNotification = async (reply, userId) => {
  if (!reply.author.equals(userId)) {
    await Notification.create({
      recipient: reply.author,
      triggerUser: userId,
      fragment: reply.fragment,
      reply: reply._id,
      notificationType: 'LIKE_REPLY',
      contentPreview: { replyText: reply.content.substring(0, 120) }
    });
  }
};

notificationController.triggerReplyDislikedNotification = async (reply, userId) => {
  if (!reply.author.equals(userId)) {
    await Notification.create({
      recipient: reply.author,
      triggerUser: userId,
      fragment: reply.fragment,
      reply: reply._id,
      notificationType: 'DISLIKE_REPLY',
      contentPreview: { replyText: reply.content.substring(0, 120) }
    });
  }
};

notificationController.triggerMentionNotification = async (userId, fragmentId, replyId = null) => {
  const fragment = await Fragment.findById(fragmentId);
  await Notification.create({
    recipient: userId,
    triggerUser: fragment.author,
    fragment: fragment._id,
    reply: replyId,
    notificationType: 'MENTION',
    contentPreview: { fragmentTitle: fragment.title.substring(0, 60) }
  });
};

module.exports = notificationController;