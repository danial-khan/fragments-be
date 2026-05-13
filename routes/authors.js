const express = require("express");
const authorsRouter = express.Router();

const authorsController = require("../controllers/authorsController");
const { authMiddleware, optionalAuthMiddleware } = require("../middlewares/auth");

authorsRouter.get("/", optionalAuthMiddleware, authorsController.getAuthors);
authorsRouter.post("/:id/follow", authMiddleware, authorsController.followAuthor);

module.exports = authorsRouter;
