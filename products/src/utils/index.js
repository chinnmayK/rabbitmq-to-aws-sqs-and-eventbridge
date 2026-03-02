const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const {
  APP_SECRET,
  EVENT_BUS_NAME,
  AWS_REGION,
  SQS_QUEUE_URL,
} = require("../config");
const logger = require("../logger");

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

// 2️⃣ EventBridge Publication
const eventBridge = new EventBridgeClient({
  region: AWS_REGION,
});

module.exports.PublishMessage = async (service, msg, correlationId) => {
  if (!EVENT_BUS_NAME) {
    logger.warn("EVENT_BUS_NAME is not set. Skipping EventBridge publish.");
    return;
  }

  const cid = correlationId || uuidv4();

  logger.info("Publishing Event", { service, event: msg.event, correlationId: cid });

  try {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: "products.service",
          DetailType: service,
          Detail: JSON.stringify({ ...msg, correlationId: cid }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await eventBridge.send(command);
    logger.info("EventBridge ACK received", { service, correlationId: cid });
  } catch (err) {
    logger.error("EventBridge publish failed", { service, error: err.message });
  }
};

// ======================================================
// 🟡 SQS CONSUMER
// ======================================================

module.exports.StartSQSConsumer = async (service) => {
  const sqs = new SQSClient({
    region: AWS_REGION,
  });

  if (!SQS_QUEUE_URL) {
    logger.warn("SQS_QUEUE_URL not defined. Skipping SQS consumer.");
    return;
  }

  logger.info("Starting SQS Consumer", { queueUrl: SQS_QUEUE_URL });

  const poll = async () => {
    try {
      logger.info("Polling SQS", { queueUrl: SQS_QUEUE_URL });

      const command = new ReceiveMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      });

      const response = await sqs.send(command);

      if (response.Messages) {
        for (const message of response.Messages) {
          const correlationId = uuidv4();

          logger.info("SQS Message Received", {
            messageId: message.MessageId,
            correlationId,
          });

          const event = JSON.parse(message.Body);

          // EventBridge wraps actual payload inside "detail"
          const payload = JSON.stringify(event.detail);

          await service.SubscribeEvents(payload, correlationId);

          // Delete after successful processing
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );

          logger.info("SQS Message Deleted", {
            messageId: message.MessageId,
            correlationId,
          });
        }
      }
    } catch (err) {
      logger.error("SQS polling error", { error: err.message });
    }

    // Continue polling
    setImmediate(poll);
  };

  poll();
};
