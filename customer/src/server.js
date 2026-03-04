const app = require("./app");
const { PORT } = require("./config");
const { databaseConnection } = require("./database");
const { StartSQSConsumer } = require("./utils");
const CustomerService = require("./services/customer-service");
const logger = require("../shared/logger");

const StartServer = async () => {
    app.listen(PORT, "0.0.0.0", () => {
        logger.info(`Customer service listening`, { port: PORT });
    }).on('error', (err) => {
        logger.error('Server failed to start', { error: err.message });
        process.exit(1);
    });

    try {
        await databaseConnection();
        const service = new CustomerService();
        StartSQSConsumer(service);
    } catch (err) {
        logger.error('Startup error', { error: err.message });
    }
};

StartServer();
