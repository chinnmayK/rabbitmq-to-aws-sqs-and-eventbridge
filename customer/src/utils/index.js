const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const {
  APP_SECRET,
  CUSTOMER_SERVICE,
  EVENT_BUS_NAME,
  AWS_REGION,
} = require("../config");

// ------------------
// EventBridge Setup
// ------------------

if (!process.env.EVENT_BUS_NAME) {
  console.warn("⚠️ EVENT_BUS_NAME is not defined in environment variables");
}

const eventBridge = new EventBridgeClient({
  region: AWS_REGION,
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

module.exports.PublishMessage = async (eventType, msg) => {
  const payload = typeof msg === "string" ? msg : JSON.stringify(msg);

  if (!EVENT_BUS_NAME) {
    console.error("❌ Cannot publish to EventBridge: EVENT_BUS_NAME not set");
    return;
  }

  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "customer.service",
            DetailType: eventType,
            Detail: payload,
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
    );

    console.log("✅ Event published to EventBridge");
  } catch (err) {
    console.error("❌ EventBridge publish failed:", err);
  }
};