const express = require('express');
const { PORT } = require('./config');
const { databaseConnection } = require('./database');
const expressApp = require('./express-app');

const { CreateChannel, SubscribeMessage, StartSQSConsumer } = require('./utils');
const ShoppingService = require('./services/shopping-service');

const StartServer = async () => {
    try {
        const app = express();

        await databaseConnection();
        // 🟢 Create RabbitMQ channel
        const channel = await CreateChannel();

        await expressApp(app, channel);

        // 🟢 Initialize service with channel
        const service = new ShoppingService(channel);

        // 🟢 Start RabbitMQ consumer (existing)
        await SubscribeMessage(channel, service);

        // 🟢 Start SQS consumer (new)
        StartSQSConsumer(service);

        app.listen(PORT, () => {
            console.log(`Shopping service listening on port ${PORT}`);
        }).on('error', (err) => {
            console.error('Server failed to start:', err);
            process.exit(1);
        });

    } catch (err) {
        console.error('Startup error:', err);
        process.exit(1);
    }
};

StartServer();