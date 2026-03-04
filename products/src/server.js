const app = require("./app");
const { PORT, AWS_REGION, EVENT_BUS_NAME, CACHE_INVALIDATED_QUEUE_URL } = require("./config");
const { databaseConnection } = require("./database");
const { StartSQSConsumer } = require("./utils");
const { CreateMessageBroker } = require("../../shared/msg-broker");
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

        // Consumer 1: OrderCreated → Products queue
        StartSQSConsumer(service);

        // Consumer 2: CacheInvalidated queue
        if (CACHE_INVALIDATED_QUEUE_URL) {
            const cacheInvalidationBroker = CreateMessageBroker({
                region: AWS_REGION,
                busName: EVENT_BUS_NAME,
                queueUrl: CACHE_INVALIDATED_QUEUE_URL,
                source: "products.service"
            });
            cacheInvalidationBroker.StartSQSConsumer(service);
            logger.info("Cache invalidation consumer started", { queueUrl: CACHE_INVALIDATED_QUEUE_URL });
        } else {
            logger.warn("CACHE_INVALIDATED_QUEUE_URL not set — cache invalidation consumer skipped");
        }
    } catch (err) {
        logger.error('Startup error', { error: err.message });
    }
};

StartServer();
