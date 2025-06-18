module.exports.checkAdmin = (req, res, next) => {
  try {
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
