/**
 * HeartbeatService.js
 * Monitors device connection status and reports to Supabase
 * Integrates with LaixiAdapter for actual device communication
 */

const EventEmitter = require('events');

class HeartbeatService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.laixiAdapter = options.laixiAdapter;
    this.supabaseClient = options.supabaseClient;
    this.nodeId = options.nodeId;

    // Configuration
    this.config = {
      intervalMs: options.intervalMs || 30000,      // 30 seconds
      timeoutMs: options.timeoutMs || 5000,          // 5 seconds per device
      failureThreshold: options.failureThreshold || 3,  // 3 consecutive failures
      ...options.config
    };

    // State tracking
    this.isRunning = false;
    this.intervalId = null;
    this.devices = new Map();  // device_serial -> DeviceState

    // Statistics
    this.stats = {
      totalHeartbeats: 0,
      successfulHeartbeats: 0,
      failedHeartbeats: 0,
      lastHeartbeatAt: null
    };
  }

  /**
   * Initialize device state tracking
   */
  _initDeviceState(deviceSerial) {
    if (!this.devices.has(deviceSerial)) {
      this.devices.set(deviceSerial, {
        serial: deviceSerial,
        status: 'unknown',
        failureCount: 0,
        lastSeen: null,
        lastLatency: null,
        currentMode: null,
        currentTaskId: null,
        batteryLevel: null,
        metadata: {}
      });
    }
    return this.devices.get(deviceSerial);
  }

  /**
   * Start heartbeat monitoring
   */
  start() {
    if (this.isRunning) {
      console.log('[HeartbeatService] Already running');
      return;
    }

    console.log(`[HeartbeatService] Starting with ${this.config.intervalMs}ms interval`);
    this.isRunning = true;

    // Run immediately, then on interval
    this._runHeartbeatCycle();
    this.intervalId = setInterval(() => {
      this._runHeartbeatCycle();
    }, this.config.intervalMs);

    this.emit('started');
  }

  /**
   * Stop heartbeat monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[HeartbeatService] Stopping');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('stopped');
  }

  /**
   * Run a complete heartbeat cycle for all devices
   */
  async _runHeartbeatCycle() {
    try {
      // Get current device list from Laixi
      const deviceList = await this._getDeviceList();

      if (!deviceList || deviceList.length === 0) {
        console.log('[HeartbeatService] No devices connected');
        this.emit('noDevices');
        return;
      }

      // Heartbeat each device
      const results = await Promise.all(
        deviceList.map(device => this._heartbeatDevice(device))
      );

      // Update statistics
      this.stats.totalHeartbeats++;
      this.stats.lastHeartbeatAt = new Date();

      const successful = results.filter(r => r.success).length;
      this.stats.successfulHeartbeats += successful;
      this.stats.failedHeartbeats += results.length - successful;

      // Log to database
      await this._logHeartbeats(results);

      this.emit('cycleComplete', {
        total: results.length,
        successful,
        failed: results.length - successful
      });

    } catch (error) {
      console.error('[HeartbeatService] Cycle error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get device list from Laixi adapter
   */
  async _getDeviceList() {
    if (!this.laixiAdapter) {
      console.warn('[HeartbeatService] No LaixiAdapter configured');
      return [];
    }

    try {
      const startTime = Date.now();
      const response = await this.laixiAdapter.sendCommand('LIST', this.config.timeoutMs);
      const latency = Date.now() - startTime;

      // Parse device list from response
      // Expected format: "device1,device2,device3" or array
      let devices = [];
      if (typeof response === 'string') {
        devices = response.split(',').filter(d => d.trim());
      } else if (Array.isArray(response)) {
        devices = response;
      } else if (response && response.devices) {
        devices = response.devices;
      }

      return devices.map(d => ({
        serial: typeof d === 'string' ? d.trim() : d.serial || d,
        latency
      }));

    } catch (error) {
      console.error('[HeartbeatService] Failed to get device list:', error);
      return [];
    }
  }

  /**
   * Heartbeat a single device
   */
  async _heartbeatDevice(device) {
    const deviceSerial = device.serial || device;
    const state = this._initDeviceState(deviceSerial);
    const startTime = Date.now();

    try {
      // Try to get device status
      // This could be a specific status command or just acknowledgment
      let status = 'connected';
      let batteryLevel = null;
      let currentMode = state.currentMode || 'unknown';

      // If Laixi supports device-specific status
      if (this.laixiAdapter && typeof this.laixiAdapter.getDeviceStatus === 'function') {
        const deviceStatus = await this.laixiAdapter.getDeviceStatus(deviceSerial);
        status = deviceStatus.status || 'connected';
        batteryLevel = deviceStatus.batteryLevel;
        currentMode = deviceStatus.currentMode || currentMode;
      }

      const latency = device.latency || (Date.now() - startTime);

      // Update state
      state.status = status;
      state.failureCount = 0;
      state.lastSeen = new Date();
      state.lastLatency = latency;
      state.batteryLevel = batteryLevel;

      this.emit('deviceHeartbeat', {
        serial: deviceSerial,
        status,
        latency,
        batteryLevel,
        currentMode
      });

      return {
        success: true,
        serial: deviceSerial,
        status,
        latency,
        batteryLevel,
        currentMode
      };

    } catch (error) {
      // Handle failure
      state.failureCount++;
      const latency = Date.now() - startTime;

      console.warn(`[HeartbeatService] Device ${deviceSerial} heartbeat failed (${state.failureCount}/${this.config.failureThreshold}):`, error.message);

      // Check if threshold exceeded
      if (state.failureCount >= this.config.failureThreshold) {
        state.status = 'disconnected';
        this.emit('deviceDisconnected', {
          serial: deviceSerial,
          failureCount: state.failureCount
        });
      } else {
        state.status = 'unstable';
      }

      return {
        success: false,
        serial: deviceSerial,
        status: state.status,
        latency,
        error: error.message,
        failureCount: state.failureCount
      };
    }
  }

  /**
   * Log heartbeat results to Supabase
   */
  async _logHeartbeats(results) {
    if (!this.supabaseClient) {
      return;
    }

    try {
      const inserts = results.map(result => ({
        device_serial: result.serial,
        node_id: this.nodeId,
        status: result.status,
        battery_level: result.batteryLevel,
        current_mode: result.currentMode || 'unknown',
        current_task_id: this.devices.get(result.serial)?.currentTaskId,
        latency_ms: result.latency,
        metadata: {
          failureCount: result.failureCount || 0,
          error: result.error
        }
      }));

      const { error } = await this.supabaseClient
        .from('device_heartbeats')
        .insert(inserts);

      if (error) {
        console.error('[HeartbeatService] Failed to log heartbeats:', error);
      }

    } catch (error) {
      console.error('[HeartbeatService] Database error:', error);
    }
  }

  /**
   * Update device current task
   */
  updateDeviceTask(deviceSerial, taskId, mode) {
    const state = this._initDeviceState(deviceSerial);
    state.currentTaskId = taskId;
    state.currentMode = mode;
  }

  /**
   * Clear device task
   */
  clearDeviceTask(deviceSerial) {
    const state = this.devices.get(deviceSerial);
    if (state) {
      state.currentTaskId = null;
      state.currentMode = 'idle';
    }
  }

  /**
   * Get device status
   */
  getDeviceStatus(deviceSerial) {
    return this.devices.get(deviceSerial) || null;
  }

  /**
   * Get all device statuses
   */
  getAllDeviceStatuses() {
    const statuses = {};
    for (const [serial, state] of this.devices) {
      statuses[serial] = { ...state };
    }
    return statuses;
  }

  /**
   * Get connected devices
   */
  getConnectedDevices() {
    const connected = [];
    for (const [serial, state] of this.devices) {
      if (state.status === 'connected' || state.status === 'busy' || state.status === 'idle') {
        connected.push(serial);
      }
    }
    return connected;
  }

  /**
   * Get idle devices (connected and not busy)
   */
  getIdleDevices() {
    const idle = [];
    for (const [serial, state] of this.devices) {
      if ((state.status === 'connected' || state.status === 'idle') && !state.currentTaskId) {
        idle.push(serial);
      }
    }
    return idle;
  }

  /**
   * Check if device is healthy
   */
  isDeviceHealthy(deviceSerial) {
    const state = this.devices.get(deviceSerial);
    if (!state) return false;

    return state.status === 'connected' ||
           state.status === 'idle' ||
           state.status === 'busy';
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      deviceCount: this.devices.size,
      connectedCount: this.getConnectedDevices().length,
      idleCount: this.getIdleDevices().length
    };
  }

  /**
   * Set Laixi adapter (for late binding)
   */
  setLaixiAdapter(adapter) {
    this.laixiAdapter = adapter;
  }

  /**
   * Set Supabase client (for late binding)
   */
  setSupabaseClient(client) {
    this.supabaseClient = client;
  }

  /**
   * Set node ID
   */
  setNodeId(nodeId) {
    this.nodeId = nodeId;
  }
}

// Singleton instance
let instance = null;

function getHeartbeatService(options) {
  if (!instance) {
    instance = new HeartbeatService(options);
  }
  return instance;
}

module.exports = {
  HeartbeatService,
  getHeartbeatService
};
