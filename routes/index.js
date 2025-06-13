const express = require("express");
const authRouter = require("./auth");
const { oAuthController } = require("../controllers/oAuthController");
const adminRouter = require("./admin");
const subscriptionRouter = require("./subscription");
const authorsRouter = require('./authors');
const categoryRouter = require("./cateogry");
const fragmentRouter = require('./fragment');
const notificationRouter = require("./notification");
const trailRouter = require('./trail');
const eventRoutes = require("./event");

const rootRouter = express.Router();

// OAuth
rootRouter.get("/oauth/google/:method", oAuthController.google);
rootRouter.get(
  "/oauth/callback/google/:method",
  oAuthController.callbackGoogle
);
// other routes
rootRouter.use("/auth", authRouter);
rootRouter.use('/admin', adminRouter);
rootRouter.use('/subscriptions', subscriptionRouter);
rootRouter.use('/categories', categoryRouter);
rootRouter.use('/fragments', fragmentRouter);
rootRouter.use('/notifications', notificationRouter);
rootRouter.use('/authors', authorsRouter);
rootRouter.use('/trails', trailRouter);
rootRouter.use("/events", eventRoutes);

module.exports = rootRouter;
