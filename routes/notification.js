const express = require("express");
const notificationRouter = express.Router();

const notificationController = require("../controllers/notificationController");
const { authMiddleware } = require("../middlewares/auth");

// GET routes
notificationRouter.get("/recent", authMiddleware, notificationController.getRecentActivityForUser);
notificationRouter.get("/all", authMiddleware, notificationController.getAllActivityForUser);
notificationRouter.get("/author", authMiddleware, notificationController.getAuthorActivity);
notificationRouter.get("/subscriptions", authMiddleware, notificationController.getSubscriptionActivity);
notificationRouter.get("/mentions", authMiddleware, notificationController.getMentions);

// POST routes
notificationRouter.post("/mark-read", authMiddleware, notificationController.markAsRead);
notificationRouter.post("/clear", authMiddleware, notificationController.clearAll);

module.exports = notificationRouter;