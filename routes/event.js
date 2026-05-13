const express = require("express");
const eventRouter = express.Router();

const eventController = require("../controllers/eventController");
const { optionalAuthMiddleware } = require("../middlewares/auth");

eventRouter.post("/track", optionalAuthMiddleware, eventController.track);

module.exports = eventRouter;
