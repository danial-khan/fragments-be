const express = require("express");
const categoryRouter = express.Router();

const categoryController = require("../controllers/categoryController");
const { authMiddleware } = require("../middlewares/auth");

categoryRouter.get("/", authMiddleware, categoryController.getCategories);

module.exports = categoryRouter;