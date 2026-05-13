const recommendationJobService = require('../services/recommendationJob');
const UserFragmentModel = require('../database/models/userFragment');
const FragmentModel = require('../database/models/fragment');
const { errorResponse, serverError } = require('../utils/response');

const recommendationController = {
  // Personalized feed when logged in; trending published fragments when guest
  getUserRecommendations: async (req, res) => {
    try {
      const {
        limit = 20,
        forceRefresh,
        page = 1,
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit, 10) || 20, 50);
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);

      if (!req.user) {
        const query = { isDeleted: false, status: 'published' };
        const total = await FragmentModel.countDocuments(query);
        const fragments = await FragmentModel.find(query)
          .sort({ viewCount: -1, createdAt: -1 })
          .skip((parsedPage - 1) * parsedLimit)
          .limit(parsedLimit)
          .populate('author', 'name username avatar')
          .populate('category', 'name color')
          .lean();

        const recommendations = fragments.map((f) => ({
          ...f,
          recommendationScore: f.viewCount || 0,
          recommendationReason: 'trending',
          aiExplanation: null,
        }));

        return res.status(200).json({
          feedMode: 'anonymous',
          feedMessage: 'Sign in for a personalized feed based on your interests.',
          recommendations,
          total,
          page: parsedPage,
          pages: Math.max(1, Math.ceil(total / parsedLimit)),
          hasMore: parsedPage * parsedLimit < total,
        });
      }

      const userId = req.user._id;
      const recommendations = await recommendationJobService.getUserRecommendations(
        userId,
        parsedLimit,
        forceRefresh === 'true'
      );

      const startIndex = (parsedPage - 1) * parsedLimit;
      const endIndex = startIndex + parsedLimit;
      const paginatedRecommendations = recommendations.slice(startIndex, endIndex);

      res.status(200).json({
        feedMode: 'personalized',
        recommendations: paginatedRecommendations,
        total: recommendations.length,
        page: parsedPage,
        pages: Math.ceil(recommendations.length / parsedLimit) || 1,
        hasMore: endIndex < recommendations.length,
      });
    } catch (error) {
      console.error('Get user recommendations error:', error);
      return serverError(res);
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
      return serverError(res);
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
      return serverError(res);
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
      return serverError(res);
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
      return serverError(res);
    }
  },

  // Admin endpoint to trigger recommendation job manually
  triggerRecommendationJob: async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return errorResponse(res, 403, "Admin access required.", "FORBIDDEN");
      }

      recommendationJobService.triggerRecommendationJob();

      res.status(200).json({ 
        message: 'Recommendation job triggered successfully',
        note: 'Job is running in background'
      });
    } catch (error) {
      console.error('Trigger recommendation job error:', error);
      return serverError(res);
    }
  },

  getJobStatus: async (req, res) => {
    try {
      if (!req.user.isAdmin) {
        return errorResponse(res, 403, "Admin access required.", "FORBIDDEN");
      }

      const status = recommendationJobService.getJobStatus();

      res.status(200).json(status);
    } catch (error) {
      console.error('Get job status error:', error);
      return serverError(res);
    }
  },

  cleanupOldRecommendations: async (req, res) => {
    try {
      if (!req.user.isAdmin) {
        return errorResponse(res, 403, "Admin access required.", "FORBIDDEN");
      }

      const deletedCount = await recommendationJobService.cleanupOldRecommendations();

      res.status(200).json({ message: 'Cleanup completed successfully', deletedCount });
    } catch (error) {
      console.error('Cleanup old recommendations error:', error);
      return serverError(res);
    }
  },

  getSimilarFragments: async (req, res) => {
    try {
      const { fragmentId } = req.params;
      const { limit = 10 } = req.query;

      const fragment = await FragmentModel.findById(fragmentId)
        .populate('category', 'name color')
        .populate('author', 'name username');

      if (!fragment) {
        return errorResponse(res, 404, "Fragment not found.", "NOT_FOUND");
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
      return serverError(res);
    }
  }
};

module.exports = recommendationController; 