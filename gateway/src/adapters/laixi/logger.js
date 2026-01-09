/**
 * Logger 모듈 - Laixi Adapter 전용 로깅
 * 
 * @author Axon (DoAi.Me Tech Lead)
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m',
};

/**
 * 로거 생성
 * @param {string} name - 로거 이름
 * @returns {Object} 로거 인스턴스
 */
function createLogger(name) {
  const prefix = `[${name}]`;
  
  return {
    error(...args) {
      console.error(`${COLORS.RED}[ERROR]${COLORS.RESET} ${prefix}`, ...args);
    },
    
    warn(...args) {
      console.warn(`${COLORS.YELLOW}[WARN]${COLORS.RESET} ${prefix}`, ...args);
    },
    
    info(...args) {
      console.log(`${COLORS.GREEN}[INFO]${COLORS.RESET} ${prefix}`, ...args);
    },
    
    debug(...args) {
      if (process.env.DEBUG) {
        console.log(`${COLORS.GRAY}[DEBUG]${COLORS.RESET} ${prefix}`, ...args);
      }
    },
    
    // WebSocket 통신 전용 로깅
    out(data) {
      console.log(`${COLORS.CYAN}[OUT]${COLORS.RESET} ${prefix}`, JSON.stringify(data));
    },
    
    in(data) {
      console.log(`${COLORS.GREEN}[IN]${COLORS.RESET} ${prefix}`, JSON.stringify(data));
    },
  };
}

module.exports = { createLogger, LOG_LEVELS };


