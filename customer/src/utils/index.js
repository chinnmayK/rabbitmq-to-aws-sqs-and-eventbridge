const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const amqplib = require("amqplib");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const {
  APP_SECRET,
  EXCHANGE_NAME,
  CUSTOMER_SERVICE,
  MSG_QUEUE_URL,
} = require("../config");

// ------------------
// EventBridge Setup
// ------------------

if (!process.env.EVENT_BUS_NAME) {
  console.warn("⚠️ EVENT_BUS_NAME is not defined in environment variables");
}

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

// ------------------
// Utility Functions
// ------------------

module.exports.GenerateSalt = async () => {
  return bcrypt.genSalt();
};

module.exports.GeneratePassword = async (password, salt) => {
  return bcrypt.hash(password, salt);
};

module.exports.ValidatePassword = async (enteredPassword, savedPassword, salt) => {
  return (await bcrypt.hash(enteredPassword, salt)) === savedPassword;
};

module.exports.GenerateSignature = async (payload) => {
  return jwt.sign(payload, APP_SECRET, { expiresIn: "30d" });
};

module.exports.ValidateSignature = async (req) => {
  try {
    const signature = req.get("Authorization");
    const payload = jwt.verify(signature.split(" ")[1], APP_SECRET);
    req.user = payload;
    return true;
  } catch {
    return false;
  }
};

module.exports.FormateData = (data) => {
  if (data) return { data };
  throw new Error("Data Not found!");
};

// ------------------
// Message Broker
// ------------------

module.exports.CreateChannel = async () => {
  let retries = 5;

  while (retries) {
    try {
      const connection = await amqplib.connect(MSG_QUEUE_URL);
      const channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_NAME, "direct", {
        durable: true,
      });

      console.log("✅ RabbitMQ Connected");
      return channel;
    } catch (err) {
      console.log("❌ RabbitMQ connection failed. Retrying...");
      retries -= 1;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }

  throw new Error("RabbitMQ connection failed");
};

module.exports.PublishMessage = async (channel, service, msg) => {
  // 1️⃣ Publish to RabbitMQ
  channel.publish(EXCHANGE_NAME, service, Buffer.from(msg));

  // 2️⃣ Publish to EventBridge
  if (!process.env.EVENT_BUS_NAME) {
    console.error("❌ Cannot publish to EventBridge: EVENT_BUS_NAME not set");
    return;
  }

  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "customer.service",
            DetailType: service,
            Detail: msg,
            EventBusName: process.env.EVENT_BUS_NAME,
          },
        ],
      })
    );

    console.log("✅ Event published to EventBridge");
  } catch (err) {
    console.error("❌ EventBridge publish failed:", err);
  }
};

module.exports.SubscribeMessage = async (channel, service) => {
  const q = await channel.assertQueue("", { exclusive: true });

  await channel.bindQueue(q.queue, EXCHANGE_NAME, CUSTOMER_SERVICE);

  channel.consume(
    q.queue,
    (msg) => {
      if (msg.content) {
        service.SubscribeEvents(msg.content.toString());
      }
    },
    { noAck: true }
  );
};