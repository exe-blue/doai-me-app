/**
 * HumanSimulator.js
 * Provides human-like behavior simulation for YouTube automation
 * Includes configurable delays, click jitter, natural scrolling, and typing patterns
 */

const EventEmitter = require('events');

class HumanSimulator extends EventEmitter {
  constructor(config = {}) {
    super();

    // Default configuration for idle mode
    this.idleConfig = {
      delayMinMs: 3000,
      delayMaxMs: 7000,
      clickErrorPx: 20,
      watchMinSeconds: 5,
      watchMaxSeconds: 60,
      likeProbability: 0.10,
      commentProbability: 0.05,
      scrollMinCount: 1,
      scrollMaxCount: 5,
      ...config.idle
    };

    // Default configuration for queue mode
    this.queueConfig = {
      delayMinMs: 5000,
      delayMaxMs: 10000,
      clickErrorPx: 20,
      adSkipWaitMinMs: 7000,
      adSkipWaitMaxMs: 20000,
      watchMinSeconds: 120,
      watchMaxSeconds: 600,
      likeProbability: 0.10,
      commentProbability: 0.05,
      randomActions: {
        backDoubleProbability: 0.01,
        forwardDoubleProbability: 0.01,
        scrollCommentsProbability: 0.01
      },
      ...config.queue
    };

    // Typing configuration
    this.typingConfig = {
      charDelayMinMs: 50,
      charDelayMaxMs: 200,
      mistakesProbability: 0.02,  // 2% chance of typo
      pauseProbability: 0.05,     // 5% chance of pause between chars
      pauseMinMs: 300,
      pauseMaxMs: 1000,
      ...config.typing
    };

    // Screen dimensions (default Galaxy S9)
    this.screenWidth = config.screenWidth || 1440;
    this.screenHeight = config.screenHeight || 2960;

    // Statistics
    this.stats = {
      delaysGenerated: 0,
      clicksSimulated: 0,
      scrollsSimulated: 0,
      typingSessionsSimulated: 0
    };
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate a random float between min and max
   */
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Check if an event should occur based on probability
   */
  shouldOccur(probability) {
    return Math.random() < probability;
  }

  /**
   * Generate a human-like delay (in milliseconds)
   * Uses gaussian-like distribution for more natural feel
   */
  generateDelay(mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    const { delayMinMs, delayMaxMs } = config;

    // Use Box-Muller transform for gaussian distribution
    const mean = (delayMinMs + delayMaxMs) / 2;
    const stdDev = (delayMaxMs - delayMinMs) / 6;  // 99.7% within range

    let u1 = Math.random();
    let u2 = Math.random();
    let z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    let delay = Math.round(mean + z * stdDev);

    // Clamp to valid range
    delay = Math.max(delayMinMs, Math.min(delayMaxMs, delay));

    this.stats.delaysGenerated++;
    return delay;
  }

  /**
   * Generate ad skip wait time
   */
  generateAdSkipDelay() {
    const { adSkipWaitMinMs, adSkipWaitMaxMs } = this.queueConfig;
    return this.randomInt(adSkipWaitMinMs, adSkipWaitMaxMs);
  }

  /**
   * Generate watch duration in seconds
   */
  generateWatchDuration(mode = 'idle', videoDurationSeconds = null) {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    let { watchMinSeconds, watchMaxSeconds } = config;

    // If video duration is known, cap at video length
    if (videoDurationSeconds && videoDurationSeconds > 0) {
      watchMaxSeconds = Math.min(watchMaxSeconds, videoDurationSeconds);
    }

    return this.randomInt(watchMinSeconds, watchMaxSeconds);
  }

  /**
   * Generate click position with human-like jitter
   * @param {number} targetX - Target X coordinate
   * @param {number} targetY - Target Y coordinate
   * @param {string} mode - 'idle' or 'queue'
   * @returns {Object} {x, y} with jitter applied
   */
  generateClickPosition(targetX, targetY, mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    const { clickErrorPx } = config;

    // Generate random offset using gaussian distribution
    const offsetX = this.randomInt(-clickErrorPx, clickErrorPx);
    const offsetY = this.randomInt(-clickErrorPx, clickErrorPx);

    // Apply offset and clamp to screen bounds
    const x = Math.max(0, Math.min(this.screenWidth - 1, targetX + offsetX));
    const y = Math.max(0, Math.min(this.screenHeight - 1, targetY + offsetY));

    this.stats.clicksSimulated++;
    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Generate normalized click position (0.0 to 1.0)
   */
  generateNormalizedClickPosition(targetX, targetY, mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    const { clickErrorPx } = config;

    // Convert error to normalized units (based on screen width)
    const normalizedError = clickErrorPx / this.screenWidth;

    const offsetX = this.randomFloat(-normalizedError, normalizedError);
    const offsetY = this.randomFloat(-normalizedError, normalizedError);

    // Clamp to 0.0 - 1.0
    const x = Math.max(0, Math.min(1, targetX + offsetX));
    const y = Math.max(0, Math.min(1, targetY + offsetY));

    this.stats.clicksSimulated++;
    return { x, y };
  }

  /**
   * Generate scroll parameters for natural scrolling
   */
  generateScrollParams(mode = 'idle') {
    const scrollCount = this.randomInt(
      this.idleConfig.scrollMinCount,
      this.idleConfig.scrollMaxCount
    );

    // Generate scroll segments with varying speeds
    const segments = [];
    for (let i = 0; i < scrollCount; i++) {
      const distance = this.randomInt(200, 600);  // pixels
      const duration = this.randomInt(200, 500);  // ms
      const pauseAfter = this.randomInt(500, 2000);  // ms

      segments.push({ distance, duration, pauseAfter });
    }

    this.stats.scrollsSimulated++;
    return {
      totalScrolls: scrollCount,
      segments
    };
  }

  /**
   * Generate typing delays for each character
   * Returns array of delays for each character
   */
  generateTypingDelays(text) {
    const delays = [];
    const { charDelayMinMs, charDelayMaxMs, mistakesProbability, pauseProbability, pauseMinMs, pauseMaxMs } = this.typingConfig;

    for (let i = 0; i < text.length; i++) {
      let delay = this.randomInt(charDelayMinMs, charDelayMaxMs);

      // Occasionally add longer pause (thinking)
      if (this.shouldOccur(pauseProbability)) {
        delay += this.randomInt(pauseMinMs, pauseMaxMs);
      }

      // Simulate typo and correction (doubles the delay)
      if (this.shouldOccur(mistakesProbability)) {
        delay *= 2;
      }

      delays.push(delay);
    }

    this.stats.typingSessionsSimulated++;
    return delays;
  }

  /**
   * Determine if action should be taken based on mode probabilities
   */
  shouldLike(mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    return this.shouldOccur(config.likeProbability);
  }

  shouldComment(mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    return this.shouldOccur(config.commentProbability);
  }

  /**
   * Generate random actions for queue mode watching
   * Returns array of actions to perform at specific timestamps
   */
  generateQueueRandomActions(watchDurationSeconds) {
    const actions = [];
    const { randomActions } = this.queueConfig;

    // Check each second of the video
    for (let second = 1; second < watchDurationSeconds; second++) {
      if (this.shouldOccur(randomActions.backDoubleProbability)) {
        actions.push({
          type: 'back_double',
          timestampSec: second,
          description: 'Double-tap to seek back 10s'
        });
      }

      if (this.shouldOccur(randomActions.forwardDoubleProbability)) {
        actions.push({
          type: 'forward_double',
          timestampSec: second,
          description: 'Double-tap to seek forward 10s'
        });
      }

      if (this.shouldOccur(randomActions.scrollCommentsProbability)) {
        actions.push({
          type: 'scroll_comments',
          timestampSec: second,
          description: 'Scroll down to comments section'
        });
      }
    }

    // Sort by timestamp
    actions.sort((a, b) => a.timestampSec - b.timestampSec);

    return actions;
  }

  /**
   * Generate staged start delays for multiple devices
   * Returns array of delays for each device
   */
  generateStagedStartDelays(deviceCount) {
    const delays = [];
    let cumulativeDelay = 0;

    for (let i = 0; i < deviceCount; i++) {
      // First device starts immediately or with small delay
      if (i === 0) {
        delays.push(this.randomInt(1000, 3000));
      } else {
        // Subsequent devices start with staged delay
        const stageDelay = this.generateDelay('queue');
        cumulativeDelay += stageDelay;
        delays.push(cumulativeDelay);
      }
    }

    return delays;
  }

  /**
   * Generate random video selection rank (1-based)
   */
  generateVideoRank(maxRank = 10) {
    // Bias towards top results
    const weights = [];
    for (let i = 1; i <= maxRank; i++) {
      weights.push(1 / i);  // 1, 0.5, 0.33, 0.25, ...
    }

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return i + 1;  // 1-based rank
      }
    }

    return 1;  // Default to first
  }

  /**
   * Generate config snapshot for logging
   */
  getConfigSnapshot(mode = 'idle') {
    const config = mode === 'queue' ? this.queueConfig : this.idleConfig;
    return {
      mode,
      delayRange: `${config.delayMinMs}-${config.delayMaxMs}ms`,
      clickErrorPx: config.clickErrorPx,
      watchRange: `${config.watchMinSeconds}-${config.watchMaxSeconds}s`,
      likeProbability: config.likeProbability,
      commentProbability: config.commentProbability,
      ...(mode === 'queue' && { randomActions: config.randomActions })
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      delaysGenerated: 0,
      clicksSimulated: 0,
      scrollsSimulated: 0,
      typingSessionsSimulated: 0
    };
  }

  /**
   * Create a promise that resolves after a human-like delay
   */
  async wait(mode = 'idle') {
    const delay = this.generateDelay(mode);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Create a promise that resolves after specified milliseconds
   */
  async waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a promise that resolves after a random delay in range
   */
  async waitRange(minMs, maxMs) {
    const delay = this.randomInt(minMs, maxMs);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Singleton instance
let instance = null;

function getHumanSimulator(config) {
  if (!instance) {
    instance = new HumanSimulator(config);
  }
  return instance;
}

module.exports = {
  HumanSimulator,
  getHumanSimulator
};
