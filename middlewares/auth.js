const jwt = require('jsonwebtoken');
const { config } = require("../config");
const UserCredentialsModel = require('../database/models/userCredentials');

module.exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies["session-token"];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;

    const { file: _, ...restUserCredentials} = (await UserCredentialsModel.findOne({
      userId: decoded._id,
    })).toJSON();

    req.userCredentials = restUserCredentials

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      message: "Un Authenticated",
    });
  }
};
