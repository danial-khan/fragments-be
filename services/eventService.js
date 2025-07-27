const Event = require("../database/models/event");

const eventService = {
  logEventToMongoDB: async (eventPayload) => {
    try {
      const event = new Event({
        payload: eventPayload,
        eventType: eventPayload.eventType || "user_event",
        timestamp: new Date(),
      });
      
      await event.save();
      console.log("✅ Saved event to MongoDB");
    } catch (error) {
      console.error("❌ Error writing to MongoDB:", error);
    }
  },

  logUserEvent: async function (eventPayload) {
    await this.logEventToMongoDB(eventPayload);
  },
};

module.exports = eventService;
