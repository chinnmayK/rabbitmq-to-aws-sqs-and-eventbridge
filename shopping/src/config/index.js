require("dotenv").config();

module.exports = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  MSG_QUEUE_URL: process.env.MSG_QUEUE_URL,
  EXCHANGE_NAME: process.env.EXCHANGE_NAME,
  APP_SECRET: process.env.APP_SECRET,
  SHOPPING_SERVICE: process.env.SHOPPING_SERVICE || "shopping_service",
  CUSTOMER_SERVICE: process.env.CUSTOMER_SERVICE || "customer_service",
  EVENT_BUS_NAME: process.env.EVENT_BUS_NAME,
  AWS_REGION: process.env.AWS_REGION || "ap-south-1",
};
