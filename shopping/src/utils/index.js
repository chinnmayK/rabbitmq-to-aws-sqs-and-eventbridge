const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const amqplib = require("amqplib");

const {
  APP_SECRET,
  EXCHANGE_NAME,
  SHOPPING_SERVICE,
  MSG_QUEUE_URL,
} = require("../config");

// ======================================================
// 🔐 AUTH & COMMON UTILITIES
// ======================================================

module.exports.GenerateSalt = async () => {
  return await bcrypt.genSalt();
};

module.exports.GeneratePassword = async (password, salt) => {
  return await bcrypt.hash(password, salt);
};

// ✅ FIXED (use bcrypt.compare instead of manual hash compare)
module.exports.ValidatePassword = async (enteredPassword, savedPassword) => {
  return await bcrypt.compare(enteredPassword, savedPassword);
};

module.exports.GenerateSignature = async (payload) => {
  return jwt.sign(payload, APP_SECRET, { expiresIn: "30d" });
};

module.exports.ValidateSignature = async (req) => {
  try {
    const signature = req.get("Authorization");

    if (!signature) return false;

    const payload = jwt.verify(signature.split(" ")[1], APP_SECRET);
    req.user = payload;
    return true;
  } catch (err) {
    return false;
  }
};

module.exports.FormateData = (data) => {
  if (data) {
    return { data };
  } else {
    throw new Error("Data Not found!");
  }
};

// ======================================================
// 🐇 RABBITMQ MESSAGE BROKER
// ======================================================

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

// ================= PUBLISH =================

module.exports.PublishMessage = async (channel, service, msg) => {
  await channel.publish(
    EXCHANGE_NAME,
    service,
    Buffer.from(JSON.stringify(msg))
  );

  console.log("📤 Message Sent to:", service);
};

// ================= SUBSCRIBE =================

module.exports.SubscribeMessage = async (channel, service) => {
  const appQueue = await channel.assertQueue(SHOPPING_SERVICE, {
    durable: true,
  });

  await channel.bindQueue(
    appQueue.queue,
    EXCHANGE_NAME,
    SHOPPING_SERVICE
  );

  channel.consume(appQueue.queue, async (data) => {
    if (data !== null) {
      console.log("📥 Received Event");

      const payload = data.content.toString();

      await service.SubscribeEvents(payload);

      channel.ack(data);
    }
  });

  console.log("👂 Subscribed to Shopping Events");
};