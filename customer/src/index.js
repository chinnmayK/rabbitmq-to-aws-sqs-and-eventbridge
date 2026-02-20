const express = require('express');
const { PORT } = require('./config');
const { databaseConnection } = require('./database');
const expressApp = require('./express-app');

const StartServer = async () => {
    try {
        const app = express();

        await databaseConnection();
        await expressApp(app);

        app.listen(PORT, () => {
            console.log(`Customer service listening on port ${PORT}`);
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