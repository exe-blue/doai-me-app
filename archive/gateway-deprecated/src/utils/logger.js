/**
 * Logger Utility
 * Winston 기반 로깅
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const winston = require('winston');

class Logger {
    constructor(level = 'info') {
        this.logger = winston.createLogger({
            level,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length 
                        ? JSON.stringify(meta) 
                        : '';
                    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
                })
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp({ format: 'HH:mm:ss' }),
                        winston.format.printf(({ timestamp, level, message, ...meta }) => {
                            const metaStr = Object.keys(meta).length 
                                ? JSON.stringify(meta) 
                                : '';
                            return `${timestamp} ${level} ${message} ${metaStr}`;
                        })
                    )
                }),
                new winston.transports.File({ 
                    filename: 'logs/error.log', 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: 'logs/combined.log' 
                })
            ]
        });
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }
}

module.exports = Logger;

