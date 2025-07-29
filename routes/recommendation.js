const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { authMiddleware } = require('../middlewares/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get personalized recommendations for the user
router.get('/user', recommendationController.getUserRecommendations);

// Mark recommendation as viewed
router.post('/view/:fragmentId', recommendationController.markRecommendationViewed);

// Mark recommendation as clicked
router.post('/click/:fragmentId', recommendationController.markRecommendationClicked);

// Get recommendation statistics
router.get('/stats', recommendationController.getRecommendationStats);

// Get recommendation reasons breakdown
router.get('/reasons', recommendationController.getRecommendationReasons);

// Get similar fragments
router.get('/similar/:fragmentId', recommendationController.getSimilarFragments);

// Admin routes
router.post('/admin/trigger-job', recommendationController.triggerRecommendationJob);
router.get('/admin/job-status', recommendationController.getJobStatus);
router.delete('/admin/cleanup', recommendationController.cleanupOldRecommendations);

module.exports = router; 