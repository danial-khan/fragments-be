const express = require('express');
const trailRouter = express.Router();
const trailController = require('../controllers/trailController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');
const { isEducatorMiddleware } = require('../middlewares/subscription');

// Trail routes (creating trails requires educator plan)
trailRouter.post('/', authMiddleware, isEducatorMiddleware, trailController.suggestTrail);
trailRouter.get('/fragment/:fragmentId', optionalAuthMiddleware, trailController.getFragmentTrails);
trailRouter.get('/author', optionalAuthMiddleware, trailController.getAuthorTrails);
trailRouter.patch('/:trailId/status', authMiddleware, trailController.updateTrailStatus);

module.exports = trailRouter; 