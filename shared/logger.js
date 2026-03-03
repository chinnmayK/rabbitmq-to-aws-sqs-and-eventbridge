const winston = require('winston');

// Service name is dynamically injected, so this base logger can be shared.
// Each service sets its own process.env.SERVICE_NAME.
const serviceName = process.env.SERVICE_NAME || 'unknown-service';

module.exports = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
});
