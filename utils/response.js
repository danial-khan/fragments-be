/**
 * Sends a structured 4xx / application error response.
 *
 * @param {import('express').Response} res
 * @param {number} status  - HTTP status code (400, 401, 403, 404, 409 …)
 * @param {string} message - Human-readable description shown to the client
 * @param {string} [code]  - Machine-readable error code for the SPA to branch on
 */
const errorResponse = (res, status, message, code = "ERROR") =>
  res.status(status).json({ success: false, message, code });

/**
 * Sends a generic 500 response without leaking internal error details.
 * Always log the error before calling this.
 *
 * @param {import('express').Response} res
 */
const serverError = (res) =>
  res.status(500).json({
    success: false,
    message: "An unexpected error occurred. Please try again later.",
    code: "INTERNAL_ERROR",
  });

module.exports = { errorResponse, serverError };
