module.exports.checkAdmin = (req, res, next) => {
  try {
    console.log("type", req.user?.type, req.user);
    if (!req.user || req.user?.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Admin only",
      });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(403).json({
      success: false,
      message: "Unauthorized: Admin only",
    });
  }
};
