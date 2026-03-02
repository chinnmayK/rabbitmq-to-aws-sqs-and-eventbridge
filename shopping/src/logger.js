const winston = require('winston');

const serviceName = process.env.SERVICE_NAME || 'shopping-service';

module.exports = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
});
