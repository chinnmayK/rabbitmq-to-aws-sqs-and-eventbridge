const mongoose = require("mongoose");
const { MONGO_URI } = require("../config");
const logger = require("../../../shared/logger");

const databaseConnection = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      tls: true,
      tlsCAFile: "/app/global-bundle.pem",
      retryWrites: false,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info("Connected to DocumentDB");

  } catch (err) {
    logger.error("DB Connection Error", { error: err.message });
    process.exit(1);
  }
};

module.exports = { databaseConnection };