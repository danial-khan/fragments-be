const UserModel = require("../database/models/user");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserCredentialsModel = require("../database/models/userCredentials");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await UserModel.findOne({ email, type: "admin" });
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

    const { name, email: userEmail, avatar, _id: userId } = user.toJSON();
    const token = jwt.sign(
      { _id: userId, name, email: userEmail, avatar },
      config.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("session-token", token, {
      domain:
        process.env.NODE_ENV === "production" ? ".mernsol.com" : "localhost",
      sameSite: "None",
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...restUser } = user?.toJSON() || {};

    return res.status(200).json({
      user: restUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password fields are required." });
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    await UserModel.create({
      name,
      email,
      password: hashedPassword,
      type: "admin",
    });

    return res.status(201).json({ message: "Admin registered!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "something went wrong" });
  }
};

const getSession = (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({ user: user });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const getStats = async (_req, res) => {
  try {
    const activeAuthors = await UserCredentialsModel.countDocuments({
      type: "author",
      status: "approved",
    });
    const inActiveAuthors = await UserCredentialsModel.countDocuments({
      type: "author",
      status: {
        $ne: "approved",
      },
    });
    const activeStudents = await UserModel.countDocuments({
      type: "student",
      status: "approved",
    });
    const inActiveStudents = await UserModel.countDocuments({
      type: "student",
      status: {
        $ne: "approved",
      },
    });
    const totalActive = await UserModel.countDocuments({
      type: {
        $nin: ["admin"],
      },
      active: true,
    });
    const totalInactive = await UserModel.countDocuments({
      type: {
        $nin: ["admin"],
      },
      active: false,
    });
    return res.status(200).json({
      activeAuthors,
      inActiveAuthors,
      activeStudents,
      inActiveStudents,
      totalActive,
      totalInactive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAuthors = async (req, res) => {
  try {
    const authors = await UserCredentialsModel.find({ type: "author" })
      .limit(100)
      .populate("userId", "name, email");
    return res.status(200).json({
      authors,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await UserCredentialsModel.find({ type: "student" })
      .limit(100)
      .populate("userId", "name, email");
    return res.status(200).json({
      students,
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateCredentialsStatus = async (req, res) => {
  try {
    const { credentialsId } = req.body;
    const { status } = req.params;
    await UserCredentialsModel.updateOne(
      { _id: credentialsId },
      { $set: { status } }
    );
    return res.status(200).json({
      success: true,
      message: "status updateds successfully",
    });
  } catch {
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports.adminController = {
  login,
  register,
  getSession,
  getStats,
  getAuthors,
  getStudents,
  updateCredentialsStatus,
};
