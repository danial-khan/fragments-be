const jwt = require("jsonwebtoken");
const { config } = require("../config");
const UserCredentialsModel = require("../database/models/userCredentials");
const UserModel = require("../database/models/user");

module.exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies["session-token"];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await UserModel.findById(decoded._id, '-password -verificationCode -resetCode -remember -__v');
    if (!user || !user.active) {
      return res.status(401).json({ message: "Unauthoriz  ed" });
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
    console.log(error);
    return res.status(401).json({
      message: "Un Authenticated",
    });
  }
};
