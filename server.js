const express = require("express");
const { connectDatabase } = require("./database");
const rootRouter = require("./routes");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { config } = require("./config");
const recommendationJobService = require("./services/recommendationJob");
const { createDefaultAdminUser } = require("./utils/createAdmin");
const { createDefaultCategories } = require("./utils/createDefaultCategories");
const globalErrorHandler = require("./middlewares/errorHandler");
const app = express();

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;
  return value.replace(/\/$/, "");
}

function buildAllowedOrigins() {
  const set = new Set();
  const envKeys = [
    "UI_BASE_URL",
    "LANDINGPAGE_BASE_URL",
    "ADMIN_BASE_URL",
    "NEXT_PUBLIC_FRONTEND_APP_BASE_URL",
  ];
  for (const key of envKeys) {
    const n = normalizeOrigin(config[key]);
    if (n) set.add(n);
  }
  const extra = (config.CORS_EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const e of extra) {
    const n = normalizeOrigin(e);
    if (n) set.add(n);
  }
  return set;
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const normalized = normalizeOrigin(origin);
      if (normalized && allowedOrigins.has(normalized)) {
        return callback(null, origin);
      }
      if (config.NODE_ENV !== "production") {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, origin);
        }
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

connectDatabase();
app.use(cookieParser());
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(rootRouter);

recommendationJobService.init();

createDefaultAdminUser();
createDefaultCategories();

app.get("/", (req, res) => {
  res.send("Node.js is now integrated!");
});

app.use(globalErrorHandler);

const PORT = config.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
