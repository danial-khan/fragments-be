const { eventHubClient, cosmosContainer } = require("../config/azure");
const { v4: uuidv4 } = require("uuid");

const SEND_MODE = "one"; // or "batch"

const eventService = {
  logEventToEventHub: async (eventPayload) => {
    try {
      if (SEND_MODE === "one") {
        await eventHubClient.sendBatch([{ body: eventPayload }]);
        console.log("✅ Sent event individually to Event Hubs");
      } else if (SEND_MODE === "batch") {
        const batch = await eventHubClient.createBatch();
        const added = batch.tryAdd({ body: eventPayload });

        if (!added) {
          console.warn("⚠️ Could not add event to batch (too large?)");
          return;
        }

        await eventHubClient.sendBatch(batch);
        console.log("✅ Sent batch to Event Hubs");
      } else {
        console.warn("⚠️ Invalid SEND_MODE. Choose 'one' or 'batch'.");
      }
    } catch (error) {
      console.error("❌ Error sending to Event Hubs:", error);
    }
  },

  logEventToCosmosDB: async (eventPayload) => {
    try {
      await cosmosContainer.items.create({ id: uuidv4(), ...eventPayload });
      console.log("✅ Saved event to Cosmos DB");
    } catch (error) {
      console.error("❌ Error writing to Cosmos DB:", error);
    }
  },

  logUserEvent: async function (eventPayload) {
    await Promise.all([
      this.logEventToEventHub(eventPayload),
      this.logEventToCosmosDB(eventPayload),
    ]);
  },
};

module.exports = eventService;
