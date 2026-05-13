/**
 * Global Express error handler — catches any error passed via next(err)
 * or thrown inside async route handlers when wrapped with express-async-errors.
 */
module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred. Please try again later.",
    code: "INTERNAL_ERROR",
  });
};
