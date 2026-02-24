const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const amqplib = require("amqplib");
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const {
  APP_SECRET,
  EXCHANGE_NAME,
  SHOPPING_SERVICE,
  MSG_QUEUE_URL,
  CUSTOMER_SERVICE,
  EVENT_BUS_NAME,
  AWS_REGION,
  PRODUCTS_SERVICE,
  SQS_QUEUE_URL,
} = require("../config");

// ------------------
// Utility
// ------------------

module.exports.GenerateSalt = async () => bcrypt.genSalt();

module.exports.GeneratePassword = async (password, salt) =>
  bcrypt.hash(password, salt);

module.exports.ValidatePassword = async (enteredPassword, savedPassword, salt) =>
  (await bcrypt.hash(enteredPassword, salt)) === savedPassword;

module.exports.GenerateSignature = async (payload) =>
  jwt.sign(payload, APP_SECRET, { expiresIn: "30d" });

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

// 2️⃣ EventBridge Publication
const eventBridge = new EventBridgeClient({
  region: AWS_REGION,
});

module.exports.PublishMessage = async (channel, service, msg) => {
  // 1️⃣ Publish to RabbitMQ
  channel.publish(EXCHANGE_NAME, service, Buffer.from(JSON.stringify(msg)));

  // 2️⃣ Publish to EventBridge
  if (!EVENT_BUS_NAME) {
    console.warn("⚠️ EVENT_BUS_NAME is not set. Skipping EventBridge publish.");
    return;
  }

  try {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: "products.service",
          DetailType: service,
          Detail: JSON.stringify(msg),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await eventBridge.send(command);
    console.log("✅ Event published to EventBridge");
  } catch (err) {
    console.error("❌ EventBridge publish failed:", err);
  }
};

module.exports.SubscribeMessage = async (channel, service) => {
  const appQueue = await channel.assertQueue(PRODUCTS_SERVICE, {
    durable: true,
  });

  const events = ["OrderCreated"];

  events.forEach(async (event) => {
    await channel.bindQueue(appQueue.queue, EXCHANGE_NAME, event);
  });

  channel.consume(appQueue.queue, async (data) => {
    if (data !== null) {
      console.log("📥 Received Event from RabbitMQ");

      const payload = data.content.toString();
      await service.SubscribeEvents(payload);

      channel.ack(data);
    }
  });

  console.log("👂 Subscribed to Products Events (RabbitMQ)");
};

// ======================================================
// 🟡 SQS CONSUMER
// ======================================================

module.exports.StartSQSConsumer = async (service) => {
  const sqs = new SQSClient({
    region: AWS_REGION,
  });

  if (!SQS_QUEUE_URL) {
    console.warn("⚠️ SQS_QUEUE_URL not defined. Skipping SQS consumer.");
    return;
  }

  console.log("🚀 Starting SQS Consumer...");

  const poll = async () => {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      });

      const response = await sqs.send(command);

      if (response.Messages) {
        for (const message of response.Messages) {
          console.log("📥 Received Event from SQS");

          const event = JSON.parse(message.Body);

          // EventBridge wraps actual payload inside "detail"
          const payload = JSON.stringify(event.detail);

          await service.SubscribeEvents(payload);

          // Delete after successful processing
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );

          console.log("🗑️ SQS message deleted");
        }
      }
    } catch (err) {
      console.error("❌ SQS polling error:", err);
    }

    // Continue polling
    setImmediate(poll);
  };

  poll();
};
