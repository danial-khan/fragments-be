const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserModel = require("../database/models/user");

module.exports.adminMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies["session-token"];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    const user = await UserModel.findOne({ _id: decoded._id, type: "admin" });
    if (!user) {
      throw new Error("unauthorized");
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      message: "Un Authenticated",
    });
  }
};
