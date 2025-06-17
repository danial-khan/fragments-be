const eventService = require("../services/eventService");
const parseUserAgent = require("./deviceInfo");
const getLocationFromIP = require("./location");

const trackUserEvent = async ({ req, eventPayload }) => {
  try {
    const userId = req.user.id;
    const timestamp = new Date().toISOString();
    const userAgent = req?.headers?.["user-agent"] || "";
    const deviceInfo = parseUserAgent(userAgent);
    const ip =
      req?.headers?.["x-forwarded-for"]?.split(",")[0] ||
      req?.socket?.remoteAddress ||
      "0.0.0.0";
    const location = getLocationFromIP(ip);

    const fullEvent = {
      userId,
      ...eventPayload,
      ip,
      location,
      deviceInfo,
      timestamp,
    };

    await eventService.logUserEvent(fullEvent);
    return { success: true };
  } catch (err) {
    console.error("🔴 Event Tracking Failed:", err);
    return { success: false };
  }
};

module.exports = trackUserEvent;
