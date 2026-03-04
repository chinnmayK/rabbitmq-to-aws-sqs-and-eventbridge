const app = require("./app");
const { PORT } = require("./config");
const { databaseConnection } = require("./database");
const { StartSQSConsumer } = require("./utils");
const { connectRedis } = require("./utils/redis-client");
const ProductService = require("./services/product-service");
const logger = require("../../shared/logger");

const StartServer = async () => {
    app.listen(PORT, "0.0.0.0", () => {
        logger.info('Products service listening', { port: PORT });
    }).on('error', (err) => {
        logger.error('Server failed to start', { error: err.message });
        process.exit(1);
    });

    try {
        await databaseConnection();
        await connectRedis();

        const service = new ProductService();
        StartSQSConsumer(service);
    } catch (err) {
        logger.error('Startup error', { error: err.message });
    }
};

StartServer();
