const express = require("express");
const { adminController } = require("../controllers/adminController");
const { adminMiddleware } = require("../middlewares/admin");
const adminRouter = express.Router();

adminRouter.post("/register", adminController.register);
adminRouter.post("/login", adminController.login);
adminRouter.get("/session", adminMiddleware, adminController.getSession);
adminRouter.get("/stats", adminMiddleware, adminController.getStats);
adminRouter.get('/authors', adminMiddleware, adminController.getAuthors);
adminRouter.get('/students', adminMiddleware, adminController.getStudents);
adminRouter.post('/credentials-status/:status', adminMiddleware, adminController.updateCredentialsStatus)
module.exports = adminRouter;
