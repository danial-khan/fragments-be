const eventService = require("../services/eventService");
const parseUserAgent = require("../utils/deviceInfo");
const getLocationFromIP = require("../utils/location");

const eventController = {
  track: async (req, res) => {
    try {
      const userId = req.user.id;
      const timestamp = new Date().toISOString();
      const userAgent = req.headers["user-agent"] || "";
      const deviceInfo = parseUserAgent(userAgent);
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress;;
      const location = getLocationFromIP(req.ip);

      const eventPayload = {
        userId,
        ...req.body,
        ip,
        location,
        deviceInfo,
        timestamp,
      };

      await eventService.logUserEvent(eventPayload);
      return res.status(200).json({ message: "Event tracked successfully" });
    } catch (error) {
      console.error("Track Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = eventController;
