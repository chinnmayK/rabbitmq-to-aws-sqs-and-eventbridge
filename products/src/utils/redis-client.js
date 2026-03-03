const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

client.on("error", (err) => {
  if (process.env.NODE_ENV !== "test") {
    console.error("Redis Client Error", err);
  }
});

async function connectRedis() {
  if (process.env.NODE_ENV === "test") return;
  if (!client.isOpen) {
    await client.connect();
  }
}

async function closeRedis() {
  if (client.isOpen) {
    await client.quit();
  }
}

module.exports = {
  client,
  connectRedis,
  closeRedis,
};
