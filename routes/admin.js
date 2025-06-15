const express = require("express");
const { adminController } = require("../controllers/adminController");
const { adminMiddleware } = require("../middlewares/admin");
const { checkAdmin } = require("../middlewares/type");
const categoryController = require("../controllers/categoryController");
const adminRouter = express.Router();

adminRouter.post("/register", checkAdmin, adminController.register);
adminRouter.post("/login", adminController.login);
adminRouter.get("/session", adminMiddleware, adminController.getSession);
adminRouter.get("/stats", adminMiddleware, adminController.getStats);
adminRouter.get('/authors', adminMiddleware, adminController.getAuthors);
adminRouter.get('/students', adminMiddleware, adminController.getStudents);
adminRouter.get('/users', adminMiddleware, adminController.getUsers);
adminRouter.post(
  "/users/:status",
  adminMiddleware,
  checkAdmin,
  adminController.updateUserStatus
);
adminRouter.post(
  "/credentials-status/:status",
  adminMiddleware,
  checkAdmin,
  adminController.updateCredentialsStatus
);

adminRouter.post(
  "/categories",
  adminMiddleware,
  checkAdmin,
  categoryController.createCategory
);
adminRouter.get('/categories', adminMiddleware, categoryController.getCategories);
adminRouter.delete(
  "/categories/:id",
  adminMiddleware,
  checkAdmin,
  categoryController.deleteCategory
);

module.exports = adminRouter;
