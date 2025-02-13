const express = require("express");
const { authController } = require("../controllers/authController");
const authRouter = express.Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/email-confirmation", authController.verifyEmail);
authRouter.get("/session", authController.getSession);
authRouter.post("/logout", authController.logout);
authRouter.post("/forgot-password", authController.forgetPassword);

module.exports = authRouter;
