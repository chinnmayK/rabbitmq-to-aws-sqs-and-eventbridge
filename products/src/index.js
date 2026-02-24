const express = require('express');
const { PORT } = require('./config');
const { databaseConnection } = require('./database');
const expressApp = require('./express-app');
const ProductService = require('./services/product-service');

const { CreateChannel, SubscribeMessage, StartSQSConsumer } = require('./utils');

const StartServer = async () => {
    try {
        const app = express();

        await databaseConnection();

        const channel = await CreateChannel();

        await expressApp(app, channel);

        // 🟢 Initialize service with channel
        const service = new ProductService(channel);

        // 🟢 Start Consumers
        await SubscribeMessage(channel, service);
        StartSQSConsumer(service);

        app.listen(PORT, () => {
            console.log(`Products service listening on port ${PORT}`);
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