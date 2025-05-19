const UserModel = require("../database/models/user");
const crypto = require("crypto");
const ejs = require("ejs");
const path = require("path");
const mailer = require("../utils/mailer");
const { config } = require("../config");
const jwt = require("jsonwebtoken");
const UserCredentialsModel = require("../database/models/userCredentials");

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

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      verificationCode,
      type: "student",
    });

    // Render email template
    const emailTemplate = await ejs.renderFile(
      path.join(__dirname, "../email-templates/register-verification.ejs"),
      {
        name,
        verificationURL: `${config.UI_BASE_URL}/email-confirmation?code=${verificationCode}`,
      }
    );

    // Send verification email
    await mailer.sendEmail(
      email,
      "Verify Your Email - Fragments",
      emailTemplate
    );

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
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(password).digest("hex"),
        "utf8"
      )
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.verificationCode) {
      return res.status(403).json({
        message: "Email not verified. Please check your email to verify.",
      });
    }
    if (!user.active) {
      return res.status(403).json({
        message: "User not active. Please contact support.",
      });
    }
    const { name, email: userEmail, avatar, _id: userId } = user.toJSON();
    const token = jwt.sign(
      { _id: userId, name, email: userEmail, avatar },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userCredentials = await UserCredentialsModel.findOne({
      userId,
    });
    const { file, ...restUserCredentials } = userCredentials?.toJSON() || {};

    res.cookie("session-token", token, {
      domain:
        process.env.NODE_ENV === "production" ? ".mernsol.com" : "localhost",
      sameSite: "None",
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      user: user?.toJSON(),
      userCredentials: userCredentials ? restUserCredentials : undefined,
    });
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
    const user = req.user;
    const userCredentials = req.userCredentials;
    res.status(200).json({ user: user, userCredentials });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("session-token", {
      domain:
        process.env.NODE_ENV === "production" ? ".mernsol.com" : "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
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
        resetURL: `${config.UI_BASE_URL}/auth/reset-password?code=${resetCode}`,
      }
    );

    await mailer.sendEmail(
      email,
      "Reset your password - Fragments",
      emailTemplate
    );

    res.status(200).json({ message: "Password reset email sent!" });
  } catch (error) {
    console.error("Reset password request error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Both old and new passwords are required.",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(oldPassword).digest("hex"),
        "utf8"
      )
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    const isSamePassword = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(newPassword).digest("hex"),
        "utf8"
      )
    );
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password.",
      });
    }
    const hashedPassword = crypto
      .createHash("sha256")
      .update(newPassword)
      .digest("hex");

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully!" });
  } catch (error) {
    console.error("Change password error:", error);
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

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    user.password = hashedPassword;
    user.resetCode = null;
    await user.save();

    res.status(200).json({
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const contactUs = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if ((!name || !email, !subject, !message)) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Render reset email template
    const userTemplate = await ejs.renderFile(
      path.join(__dirname, "../email-templates/contactus-user.ejs"),
      {
        name,
        subject,
        message,
      }
    );

    await mailer.sendEmail(
      email,
      "Your details have been submitted - Fragments",
      userTemplate
    );

    // Render reset email template
    const adminTemplate = await ejs.renderFile(
      path.join(__dirname, "../email-templates/contactus-admin.ejs"),
      {
        name,
        email,
        subject,
        message,
      }
    );

    await mailer.sendEmail(
      config.CONTACT_EMAIL,
      "User has submitted contact us form - Fragments",
      adminTemplate
    );

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong",
    });
  }
};

const onboarding = async (req, res) => {
  try {
    const user = req.user;
    const { name, credentials, institution, expertise, file, bio, type } =
      req.body;

    if (!name || !credentials || !institution || !expertise || !bio || !type) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (type === "author" && !file) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const userCredentials = await UserCredentialsModel.create({
      name,
      credentials,
      institution,
      expertise,
      file,
      bio,
      type,
      userId: user._id,
      status: type === "student" ? "approved" : "pending",
    });

    await UserModel.updateOne({ _id: user._id }, { $set: { type } });

    res
      .status(201)
      .json({ message: "Onboarding successful.", userCredentials });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const updateCredentialsStatus = async (req, res) => {
  try {
    const userCredentialsId = req.userCredentials._id;
    const { status } = req.params;

    if (status === "resubmit") {
      await UserCredentialsModel.deleteOne({ _id: userCredentialsId });
    } else {
      await UserCredentialsModel.updateOne(
        {
          _id: userCredentialsId,
        },
        { $set: { status } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Credentials status updated successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
};

module.exports.authController = {
  register,
  login,
  verifyEmail,
  getSession,
  logout,
  forgetPassword,
  changePassword,
  resetPassword,
  contactUs,
  onboarding,
  updateCredentialsStatus,
};
