/**
 * Laixi Adapter Module
 * 
 * YouTube 자동화 시스템의 디바이스 제어 레이어
 * 
 * @author Axon (Tech Lead)
 */

const LaixiAdapter = require('./LaixiAdapter');
const { SomaticEngine } = require('./SomaticEngine');
const { YouTubeController, SEARCH_TYPE, CONFIG } = require('./YouTubeController');
const { createLogger } = require('./logger');

module.exports = {
  // Core Adapter
  LaixiAdapter,
  LAIXI_COMMANDS: LaixiAdapter.LAIXI_COMMANDS,
  CONNECTION_STATE: LaixiAdapter.CONNECTION_STATE,
  
  // Controllers
  YouTubeController,
  SomaticEngine,
  
  // Utilities
  createLogger,
  
  // Constants
  SEARCH_TYPE,
  CONFIG,
};


