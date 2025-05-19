const express = require("express");
const authorsRouter = express.Router();

const authorsController = require("../controllers/authorsController");
const { authMiddleware } = require("../middlewares/auth");

authorsRouter.get("/", authMiddleware, authorsController.getAuthors);
authorsRouter.post("/:id/follow", authMiddleware, authorsController.followAuthor);

module.exports = authorsRouter;
