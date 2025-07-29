const recommendationJobService = require('../services/recommendationJob');
const UserFragmentModel = require('../database/models/userFragment');
const FragmentModel = require('../database/models/fragment');

const recommendationController = {
  // Get personalized recommendations for the authenticated user
  getUserRecommendations: async (req, res) => {
    try {
      const userId = req.user._id;
      const { 
        limit = 20, 
        forceRefresh,
        page = 1 
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit), 50); // Max 50 recommendations
      const parsedPage = Math.max(1, parseInt(page));

      const recommendations = await recommendationJobService.getUserRecommendations(
        userId, 
        parsedLimit, 
        forceRefresh === 'true'
      );

      // Apply pagination
      const startIndex = (parsedPage - 1) * parsedLimit;
      const endIndex = startIndex + parsedLimit;
      const paginatedRecommendations = recommendations.slice(startIndex, endIndex);

      res.status(200).json({
        recommendations: paginatedRecommendations,
        total: recommendations.length,
        page: parsedPage,
        pages: Math.ceil(recommendations.length / parsedLimit),
        hasMore: endIndex < recommendations.length
      });
    } catch (error) {
      console.error('Get user recommendations error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Mark a recommendation as viewed
  markRecommendationViewed: async (req, res) => {
    try {
      const userId = req.user._id;
      const { fragmentId } = req.params;

      await recommendationJobService.updateUserInteraction(userId, fragmentId, 'view');

      res.status(200).json({ message: 'Recommendation marked as viewed' });
    } catch (error) {
      console.error('Mark recommendation viewed error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Mark a recommendation as clicked
  markRecommendationClicked: async (req, res) => {
    try {
      const userId = req.user._id;
      const { fragmentId } = req.params;

      await recommendationJobService.updateUserInteraction(userId, fragmentId, 'click');

      res.status(200).json({ message: 'Recommendation marked as clicked' });
    } catch (error) {
      console.error('Mark recommendation clicked error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get recommendation statistics for the user
  getRecommendationStats: async (req, res) => {
    try {
      const userId = req.user._id;

      const stats = await UserFragmentModel.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalRecommendations: { $sum: 1 },
            viewedRecommendations: { $sum: { $cond: ['$isViewed', 1, 0] } },
            clickedRecommendations: { $sum: { $cond: ['$isClicked', 1, 0] } },
            averageScore: { $avg: '$score' },
            topReason: {
              $max: {
                $cond: [
                  { $eq: ['$reason', 'category_match'] },
                  { reason: '$reason', count: 1 },
                  { reason: '$reason', count: 0 }
                ]
              }
            }
          }
        }
      ]);

      const recommendationStats = stats[0] || {
        totalRecommendations: 0,
        viewedRecommendations: 0,
        clickedRecommendations: 0,
        averageScore: 0
      };

      // Calculate engagement rate
      const engagementRate = recommendationStats.totalRecommendations > 0 
        ? (recommendationStats.clickedRecommendations / recommendationStats.totalRecommendations) * 100 
        : 0;

      res.status(200).json({
        ...recommendationStats,
        engagementRate: Math.round(engagementRate * 100) / 100
      });
    } catch (error) {
      console.error('Get recommendation stats error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get recommendation reasons breakdown
  getRecommendationReasons: async (req, res) => {
    try {
      const userId = req.user._id;

      const reasons = await UserFragmentModel.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 },
            averageScore: { $avg: '$score' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.status(200).json({ reasons });
    } catch (error) {
      console.error('Get recommendation reasons error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Admin endpoint to trigger recommendation job manually
  triggerRecommendationJob: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Run job in background
      recommendationJobService.triggerRecommendationJob();

      res.status(200).json({ 
        message: 'Recommendation job triggered successfully',
        note: 'Job is running in background'
      });
    } catch (error) {
      console.error('Trigger recommendation job error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Admin endpoint to get job status
  getJobStatus: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const status = recommendationJobService.getJobStatus();

      res.status(200).json(status);
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Admin endpoint to clean up old recommendations
  cleanupOldRecommendations: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const deletedCount = await recommendationJobService.cleanupOldRecommendations();

      res.status(200).json({ 
        message: 'Cleanup completed successfully',
        deletedCount
      });
    } catch (error) {
      console.error('Cleanup old recommendations error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get similar fragments based on a specific fragment
  getSimilarFragments: async (req, res) => {
    try {
      const { fragmentId } = req.params;
      const { limit = 10 } = req.query;

      const fragment = await FragmentModel.findById(fragmentId)
        .populate('category', 'name color')
        .populate('author', 'name username');

      if (!fragment) {
        return res.status(404).json({ error: 'Fragment not found' });
      }

      // Find fragments with similar characteristics
      const similarFragments = await FragmentModel.find({
        _id: { $ne: fragmentId },
        isDeleted: false,
        status: 'published',
        $or: [
          { category: fragment.category._id },
          { 
            $text: { 
              $search: fragment.title.split(' ').slice(0, 3).join(' ') 
            } 
          }
        ]
      })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .populate('category', 'name color')
      .populate('author', 'name username')
      .lean();

      res.status(200).json({
        originalFragment: fragment,
        similarFragments
      });
    } catch (error) {
      console.error('Get similar fragments error:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = recommendationController; 