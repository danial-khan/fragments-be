const express = require('express');
const trailRouter = express.Router();
const trailController = require('../controllers/trailController');
const { authMiddleware } = require('../middlewares/auth');

// Trail routes
trailRouter.post('/', authMiddleware, trailController.suggestTrail);
trailRouter.get('/fragment/:fragmentId', authMiddleware, trailController.getFragmentTrails);
trailRouter.get('/author', authMiddleware, trailController.getAuthorTrails);
trailRouter.patch('/:trailId/status', authMiddleware, trailController.updateTrailStatus);

module.exports = trailRouter; 