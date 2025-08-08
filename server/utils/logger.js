const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger factory
const createLogger = (service) => {
    return winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: logFormat,
        defaultMeta: { service },
        transports: [
            // Write all logs to combined.log
            new winston.transports.File({ 
                filename: path.join(logsDir, 'combined.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 5
            }),
            // Write error logs to error.log
            new winston.transports.File({ 
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5
            }),
            // Console transport for development
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            })
        ]
    });
};

module.exports = { createLogger };
