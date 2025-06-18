const express = require("express");
const { adminController } = require("../controllers/adminController");
const { adminMiddleware } = require("../middlewares/admin");
const { checkAdmin } = require("../middlewares/type");
const categoryController = require("../controllers/categoryController");
const adminRouter = express.Router();

adminRouter.post("/register", adminMiddleware, checkAdmin, adminController.register);
adminRouter.post("/login", adminController.login);
adminRouter.get("/session", adminMiddleware, adminController.getSession);
adminRouter.get("/stats", adminMiddleware, adminController.getStats);
adminRouter.get('/authors', adminMiddleware, adminController.getAuthors);
adminRouter.get(
  "/authors/all",
  adminMiddleware,
  adminController.getAuthorsFromUsersTable
);
adminRouter.get('/students', adminMiddleware, adminController.getStudents);
adminRouter.get('/users', adminMiddleware, adminController.getUsers);
adminRouter.get(
  "/fragments",
  adminMiddleware,
  adminController.getAllFragmentsForAdmin
);
adminRouter.post(
  "/replies/:status",
  adminMiddleware,
  adminController.toggleReplyStatus
);
adminRouter.get(
  "/comments",
  adminMiddleware,
  adminController.getAllCommentsForAdmin
);
adminRouter.get(
  "/fragments",
  adminMiddleware,
  adminController.getAllFragmentsForAdmin
);
adminRouter.post(
  "/users/:status",
  adminMiddleware,
  adminController.updateUserStatus
);
adminRouter.post(
  "/credentials-status/:status",
  adminMiddleware,
  adminController.updateCredentialsStatus
);
adminRouter.post(
  "/fragments/:status",
  adminMiddleware,
  adminController.updateFragmentStatus
);

adminRouter.post(
  "/categories",
  adminMiddleware,
  categoryController.createCategory
);
adminRouter.get('/categories', adminMiddleware, categoryController.getCategories);
adminRouter.delete(
  "/categories/:id",
  adminMiddleware,
  categoryController.deleteCategory
);

module.exports = adminRouter;
