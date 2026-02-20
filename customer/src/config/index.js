require("dotenv").config();

module.exports = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  MSG_QUEUE_URL: process.env.MSG_QUEUE_URL,   
  EXCHANGE_NAME: process.env.EXCHANGE_NAME,
  APP_SECRET: process.env.APP_SECRET,
  CUSTOMER_SERVICE: process.env.CUSTOMER_SERVICE
};
