const express = require("express");
const authRouter = require("./auth");
const { oAuthController } = require("../controllers/oAuthController");
const adminRouter = require("./admin");

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

module.exports = rootRouter;
