const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserCredentialsModel = require("../database/models/userCredentials");
const UserModel = require("../database/models/user");

/**
 * Attaches req.user / req.userCredentials when a valid session cookie exists;
 * otherwise req.user is null. Never returns 401 (for public reads + guests).
 */
module.exports.optionalAuthMiddleware = async (req, res, next) => {
  req.user = null;
  req.userCredentials = undefined;
  try {
    const token = req.cookies["session-token"];
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await UserModel.findById(
      decoded._id,
      "-password -verificationCode -resetCode -remember -__v"
    );
    if (!user || !user.active) {
      return next();
    }

    req.user = user;

    const userCredentials = await UserCredentialsModel.findOne({
      userId: decoded._id,
    });
    if (userCredentials) {
      const { file: _, ...restUserCredentials } = userCredentials.toJSON();
      req.userCredentials = restUserCredentials;
    }

    next();
  } catch {
    next();
  }
};

module.exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies["session-token"];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await UserModel.findById(decoded._id, '-password -verificationCode -resetCode -remember -__v');
    if (!user || !user.active) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    

    const userCredentials = 
      await UserCredentialsModel.findOne({
        userId: decoded._id,
      })
    if (userCredentials) {
      const { file: _, ...restUserCredentials } = userCredentials?.toJSON();
      req.userCredentials = restUserCredentials;
    }

    next();
  } catch (error) {
    console.error("authMiddleware:", error.message);
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
};
