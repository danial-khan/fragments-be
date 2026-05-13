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
    } catch (error) {
      console.error("Error writing event to MongoDB:", error);
    }
  },

  logUserEvent: async function (eventPayload) {
    await this.logEventToMongoDB(eventPayload);
  },
};

module.exports = eventService;
