const express = require("express");
const categoryRouter = express.Router();

const categoryController = require("../controllers/categoryController");

categoryRouter.get("/", categoryController.getCategories);

module.exports = categoryRouter;