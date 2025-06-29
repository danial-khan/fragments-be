const express = require("express");
const subscriptionRouter = express.Router();

const subscriptionController = require("../controllers/subscriptionController");
const { authMiddleware } = require("../middlewares/auth");

subscriptionRouter.post("/create-checkout-session", authMiddleware, subscriptionController.createCheckoutSession);
subscriptionRouter.get('/success/:session_id', authMiddleware, subscriptionController.paymentSuccess);
module.exports = subscriptionRouter;