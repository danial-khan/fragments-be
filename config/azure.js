const { EventHubProducerClient } = require("@azure/event-hubs");
const { CosmosClient } = require("@azure/cosmos");
const { config } = require("./index");

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOS_URI,
  key: config.COSMOS_PRIMARY_KEY,
});

const cosmosDB = cosmosClient.database(config.COSMOS_DATABASE);
const cosmosContainer = cosmosDB.container(config.COSMOS_CONTAINER);

const eventHubClient = new EventHubProducerClient(
  config.EVENTHUBS_PRIMARY_CONNECTION_STRING,
  config.EVENTHUBS_NAME
);

module.exports = {
  cosmosContainer,
  eventHubClient,
};
