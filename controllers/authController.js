const UserModel = require("../database/models/user");
const bcrypt = require("bcrypt");
const ejs = require("ejs");
const path = require("path");
const mailer = require("../utils/mailer");
const { config } = require("../config");
const jwt = require("jsonwebtoken");

// Registration function
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      verificationCode,
    });

    // Render email template
    const emailTemplate = await ejs.renderFile(
      path.join(__dirname, "../email-templates/register-verification.ejs"),
      {
        name,
        verificationURL: `${config.FRONTEND_URL}/email-confirmation?code=${verificationCode}`,
      }
    );

    // Send verification email
    await mailer.sendEmail(email, emailTemplate);

    res
      .status(201)
      .json({ message: "User registered. Verification email sent!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.verificationCode) {
      return res.status(403).json({
        message: "Email not verified. Please check your email to verify.",
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("session-token", token, {
      sameSite: "None",
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login Successful!" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res
        .status(400)
        .json({ message: "Verification code is required." });
    }
    const user = await UserModel.findOne({ verificationCode: code });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code." });
    }
    user.active = true;
    user.verificationCode = null;
    await user.save();
    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSession = (req, res) => {
  try {
    const token = req.cookies["session-token"];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    res.status(200).json({ user: decoded });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("session-token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    await user.save();

    // Render reset email template
    const emailTemplate = await ejs.renderFile(
      path.join(__dirname, "../email-templates/forget-password.ejs"),
      {
        name: user.name,
        resetURL: `${config.FRONTEND_URL}/auth/reset-password?code=${resetCode}`,
      }
    );

    await mailer.sendEmail(email, emailTemplate);

    res.status(200).json({ message: "Password reset email sent!" });
  } catch (error) {
    console.error("Reset password request error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code || !password) {
      return res
        .status(400)
        .json({ message: "Reset code and new password are required." });
    }

    const user = await UserModel.findOne({ resetCode: code });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset code." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetCode = null;
    await user.save();

    res
      .status(200)
      .json({
        message:
          "Password reset successful. You can now log in with your new password.",
      });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports.authController = {
  register,
  login,
  verifyEmail,
  getSession,
  logout,
  forgetPassword,
  resetPassword,
};
