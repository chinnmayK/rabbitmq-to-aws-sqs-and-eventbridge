const express = require('express');
const { PORT } = require('./config');
const { databaseConnection } = require('./database');
const expressApp = require('./express-app');

const { StartSQSConsumer } = require('./utils');
const ShoppingService = require('./services/shopping-service');
const logger = require('./logger');

const StartServer = async () => {
    try {
        const app = express();

        await databaseConnection();
        await expressApp(app);

        // 🟢 Initialize service
        const service = new ShoppingService();

        // 🟢 Start SQS consumer (new)
        StartSQSConsumer(service);

        app.listen(PORT, () => {
            logger.info('Shopping service listening', { port: PORT });
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