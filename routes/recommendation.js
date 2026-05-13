const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

router.get('/user', optionalAuthMiddleware, recommendationController.getUserRecommendations);

router.post('/view/:fragmentId', authMiddleware, recommendationController.markRecommendationViewed);
router.post('/click/:fragmentId', authMiddleware, recommendationController.markRecommendationClicked);
router.get('/stats', authMiddleware, recommendationController.getRecommendationStats);
router.get('/reasons', authMiddleware, recommendationController.getRecommendationReasons);
router.get('/similar/:fragmentId', recommendationController.getSimilarFragments);

router.post('/admin/trigger-job', authMiddleware, recommendationController.triggerRecommendationJob);
router.get('/admin/job-status', authMiddleware, recommendationController.getJobStatus);
router.delete('/admin/cleanup', authMiddleware, recommendationController.cleanupOldRecommendations);

module.exports = router;
