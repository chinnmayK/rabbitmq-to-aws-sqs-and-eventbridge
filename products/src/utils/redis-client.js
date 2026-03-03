const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const client = createClient({
  url: redisUrl,
});

client.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

async function connectRedis() {
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
