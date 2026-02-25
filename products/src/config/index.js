require("dotenv").config();

module.exports = {
  PORT: process.env.PORT,
  APP_SECRET: process.env.APP_SECRET,
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL,
  CUSTOMER_SERVICE: process.env.CUSTOMER_SERVICE || "customer_service",
  EVENT_BUS_NAME: process.env.EVENT_BUS_NAME,
  AWS_REGION: process.env.AWS_REGION || "ap-south-1",
  PRODUCTS_SERVICE: "products_service",
  SQS_QUEUE_URL: process.env.SQS_QUEUE_URL,
};
