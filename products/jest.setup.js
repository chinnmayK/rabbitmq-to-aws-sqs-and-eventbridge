const { closeRedis } = require("./src/utils/redis-client");

afterAll(async () => {
    await closeRedis();
});
