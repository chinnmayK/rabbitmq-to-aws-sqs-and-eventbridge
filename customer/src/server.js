const app = require("./app");
const { PORT } = require("./config");
const { databaseConnection } = require("./database");
const { StartSQSConsumer } = require("./utils");
const CustomerService = require("./services/customer-service");
const logger = require("./logger");

const StartServer = async () => {
    try {
        await databaseConnection();

        const service = new CustomerService();
        StartSQSConsumer(service);

        app.listen(PORT, "0.0.0.0", () => {
            logger.info(`Customer service listening`, { port: PORT });
        }).on('error', (err) => {
            logger.error('Server failed to start', { error: err.message });
            process.exit(1);
        });

    } catch (err) {
        logger.error('Startup error', { error: err.message });
        process.exit(1);
    }
};

StartServer();
