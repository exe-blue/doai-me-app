/**
 * Logger Module
 * 로그 관리 및 출력
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    constructor(config) {
        this.level = LOG_LEVELS[config.settings.log_level] || LOG_LEVELS.info;
        this.deviceId = config.device.id;
    }

    _log(level, message, data) {
        if (LOG_LEVELS[level] >= this.level) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${this.deviceId}] [${level.toUpperCase()}]`;

            if (data) {
                console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
            } else {
                console.log(`${prefix} ${message}`);
            }
        }
    }

    debug(message, data) {
        this._log('debug', message, data);
    }

    info(message, data) {
        this._log('info', message, data);
    }

    warn(message, data) {
        this._log('warn', message, data);
    }

    error(message, data) {
        this._log('error', message, data);
    }
}

module.exports = Logger;
