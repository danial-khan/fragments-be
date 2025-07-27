const mongoose = require("mongoose");
const { config } = require("../config");

module.exports.connectDatabase = () =>
  mongoose
    .connect(config.DB_URL)
    .then(() => {
      console.log("Database connection established...");
    })
    .catch((error) => {
      console.log("couldn't connect to mongodb", error.message);
    });
