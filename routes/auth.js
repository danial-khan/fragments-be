const express = require("express");
const { authController } = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/auth");
const authRouter = express.Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/email-confirmation", authController.verifyEmail);
authRouter.get("/session", authMiddleware, authController.getSession);
authRouter.post("/logout", authController.logout);
authRouter.post("/forgot-password", authController.forgetPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.post("/contact-us", authController.contactUs);
authRouter.post("/onboarding", authMiddleware, authController.onboarding);
// authRouter.post("/onboarding/student", authController.onBoardingAuthor);

module.exports = authRouter;
