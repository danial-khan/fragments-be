const express = require("express");
const eventRouter = express.Router();

const eventController = require("../controllers/eventController");
const { authMiddleware } = require("../middlewares/auth");

eventRouter.post("/track", authMiddleware, eventController.track);

module.exports = eventRouter;
