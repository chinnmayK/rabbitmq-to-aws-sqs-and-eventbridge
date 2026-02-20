require("dotenv").config();

module.exports = {
  PORT: process.env.PORT,
  APP_SECRET: process.env.APP_SECRET,
  EXCHANGE_NAME: process.env.EXCHANGE_NAME,
  SHOPPING_SERVICE: process.env.SHOPPING_SERVICE,
  MSG_QUEUE_URL: process.env.MSG_QUEUE_URL,
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL,
};
