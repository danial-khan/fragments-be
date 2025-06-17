const trackUserEvent = require("../utils/trackEvent");

const eventController = {
  track: async (req, res) => {
    try {
      const eventPayload = req.body;

      const result = await trackUserEvent({ req, eventPayload });

      if (result.success) {
        return res.status(200).json({ message: "Event tracked successfully" });
      } else {
        return res.status(500).json({ error: "Failed to track event" });
      }
    } catch (error) {
      console.error("Track Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = eventController;
