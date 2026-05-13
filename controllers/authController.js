const UserModel = require("../database/models/user");
const crypto = require("crypto");
const ejs = require("ejs");
const path = require("path");
const mailer = require("../utils/mailer");
const { config } = require("../config");
const jwt = require("jsonwebtoken");
const UserCredentialsModel = require("../database/models/userCredentials");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");
const { errorResponse, serverError } = require("../utils/response");

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, 400, "All fields are required.", "VALIDATION_ERROR");
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 409, "An account with this email already exists.", "USER_EXISTS");
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const baseUsername = slugify(name);
    let username = baseUsername;
    let counter = 1;

    while (await UserModel.findOne({ username })) {
      username = `${baseUsername}-${counter++}`;
    }

    await UserModel.create({
      name,
      email,  
      username,
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
    return serverError(res);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required.", "VALIDATION_ERROR");
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(password).digest("hex"),
        "utf8"
      )
    );
    if (!isMatch) {
      return errorResponse(res, 401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (user.verificationCode) {
      return errorResponse(res, 403, "Email not verified. Please check your inbox.", "EMAIL_NOT_VERIFIED");
    }
    if (!user.active) {
      return errorResponse(res, 403, "This account is inactive. Please contact support.", "ACCOUNT_INACTIVE");
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
        process.env.NODE_ENV === "production" ? ".fragmenttrails.com" : "localhost",
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
    return serverError(res);
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return errorResponse(res, 400, "Verification code is required.", "VALIDATION_ERROR");
    }
    const user = await UserModel.findOne({ verificationCode: code });
    if (!user) {
      return errorResponse(res, 400, "Invalid or expired verification code.", "INVALID_CODE");
    }
    user.active = true;
    user.verificationCode = null;
    await user.save();
    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return serverError(res);
  }
};

const getSession = (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(200).json({ user: null, userCredentials: null });
    }
    const userCredentials = req.userCredentials ?? null;
    res.status(200).json({
      user: typeof user.toJSON === "function" ? user.toJSON() : user,
      userCredentials,
    });
  } catch (error) {
    console.error("Get session error:", error);
    return serverError(res);
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("session-token", {
      domain:
        process.env.NODE_ENV === "production" ? ".fragmenttrails.com" : "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return serverError(res);
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, "Email is required.", "VALIDATION_ERROR");
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return errorResponse(res, 404, "No account found with that email.", "USER_NOT_FOUND");
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
    console.error("Forgot password error:", error);
    return serverError(res);
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword || !newPassword) {
      return errorResponse(res, 400, "Both old and new passwords are required.", "VALIDATION_ERROR");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return errorResponse(res, 404, "User not found.", "USER_NOT_FOUND");
    }
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(oldPassword).digest("hex"),
        "utf8"
      )
    );
    if (!isMatch) {
      return errorResponse(res, 401, "Current password is incorrect.", "INVALID_CREDENTIALS");
    }

    const isSamePassword = crypto.timingSafeEqual(
      Buffer.from(user.password, "utf8"),
      Buffer.from(
        crypto.createHash("sha256").update(newPassword).digest("hex"),
        "utf8"
      )
    );
    if (isSamePassword) {
      return errorResponse(res, 400, "New password must be different from the current password.", "VALIDATION_ERROR");
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
    return serverError(res);
  }
};

const editProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, username, bio, website, showStats, location, socialLinks } =
      req.body;

    if (!name || !username) {
      return errorResponse(res, 400, "Name and username are required.", "VALIDATION_ERROR");
    }

    const user = await UserModel.findById(userId);
    if (!user) return errorResponse(res, 404, "User not found.", "USER_NOT_FOUND");

    user.name = name;
    user.username = username;
    user.website = website;
    user.showStats = showStats;

    if (location) {
      const parsedLocation =
        typeof location === "string" ? JSON.parse(location) : location;
      user.location = {
        country: parsedLocation.country || "",
        state: parsedLocation.state || "",
        city: parsedLocation.city || "",
      };
    }

    if (socialLinks) {
      const parsedLinks =
        typeof socialLinks === "string" ? JSON.parse(socialLinks) : socialLinks;
      user.socialLinks = {
        twitter: parsedLinks.twitter || "",
        github: parsedLinks.github || "",
        linkedin: parsedLinks.linkedin || "",
        instagram: parsedLinks.instagram || "",
      };
    }

    if (req.files?.avatar) {
      const avatarFile = req.files.avatar[0];
      if (user.avatar?.public_id) {
        await deleteFromCloudinary(user.avatar.public_id);
      }
      const uploaded = await uploadToCloudinary(avatarFile);
      user.avatar = {
        public_id: uploaded.public_id,
        url: uploaded.url,
      };
    }

    if (req.files?.cover) {
      const coverFile = req.files.cover[0];
      if (user.cover?.public_id) {
        await deleteFromCloudinary(user.cover.public_id);
      }
      const uploadedCover = await uploadToCloudinary(coverFile);
      user.cover = {
        public_id: uploadedCover.public_id,
        url: uploadedCover.url,
      };
    }

    await user.save();

    const userCredentialsDoc = await UserCredentialsModel.findOne({ userId });
    if (userCredentialsDoc && bio !== undefined) {
      userCredentialsDoc.bio = bio;
      await userCredentialsDoc.save();
    }

    const {
      _id,
      name: uName,
      username: uUsername,
      email,
      showStats: uShowStats,
      type,
      subscription,
      avatar,
      cover,
      location: uLocation,
      website: uWebsite,
      socialLinks: uLinks,
    } = user.toJSON();

    const userCredentials = userCredentialsDoc
      ? (() => {
          const { file, ...rest } = userCredentialsDoc.toJSON();
          return rest;
        })()
      : null;

    return res.status(200).json({
      user: {
        _id,
        name: uName,
        username: uUsername,
        email,
        type,
        subscription,
        showStats: uShowStats,
        avatar,
        cover,
        location: uLocation,
        website: uWebsite,
        socialLinks: uLinks,
        bio: userCredentials?.bio || null,
      },
      userCredentials,
    });
  } catch (error) {
    console.error("Edit profile error:", error);
    return serverError(res);
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
      return errorResponse(res, 400, "Invalid or expired reset code.", "INVALID_CODE");
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
    return serverError(res);
  }
};

const contactUs = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return errorResponse(res, 400, "All fields are required.", "VALIDATION_ERROR");
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
    console.error("Contact us error:", error);
    return serverError(res);
  }
};

const onboarding = async (req, res) => {
  try {
    const user = req.user;
    const { name, credentials, institution, expertise, file, bio, type } =
      req.body;

    if (!name || !credentials || !institution || !expertise || !bio || !type) {
      return errorResponse(res, 400, "All fields are required.", "VALIDATION_ERROR");
    }

    if (type === "author" && !file) {
      return errorResponse(res, 400, "A credential document is required for authors.", "VALIDATION_ERROR");
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
    return serverError(res);
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
  } catch (error) {
    console.error("Update credentials status error:", error);
    return serverError(res);
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
  editProfile,
  resetPassword,
  contactUs,
  onboarding,
  updateCredentialsStatus,
};
