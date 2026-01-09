/**
 * Discovery Configuration
 * 
 * Aria 명세서 (2025-01-15) - Dynamic Device Architecture v3.0
 * 
 * 환경별 디바이스 스캔 설정
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

/**
 * 환경별 프리셋
 */
const PRESETS = {
    development: {
        usb: { enabled: true, pollIntervalMs: 5000 },
        wifi: { 
            enabled: false,
            knownDevices: [],
            subnetScan: { enabled: false }
        },
        lan: { enabled: false, fixedDevices: [] },
        scanIntervalMs: 30000,
        connectionTimeoutMs: 5000,
        healthCheckIntervalMs: 10000
    },
    testing: {
        usb: { enabled: true, pollIntervalMs: 5000 },
        wifi: { 
            enabled: true, 
            knownDevices: [],
            subnetScan: { enabled: false }
        },
        lan: { enabled: false, fixedDevices: [] },
        scanIntervalMs: 60000,
        connectionTimeoutMs: 5000,
        healthCheckIntervalMs: 10000
    },
    production: {
        usb: { enabled: false, pollIntervalMs: 5000 },
        wifi: { 
            enabled: true,
            knownDevices: [],
            subnetScan: { enabled: false }
        },
        lan: { 
            enabled: true,
            fixedDevices: []
        },
        scanIntervalMs: 120000,
        connectionTimeoutMs: 5000,
        healthCheckIntervalMs: 10000
    }
};

/**
 * 환경변수에서 설정 로드
 */
function loadDiscoveryConfig() {
    const env = process.env.NODE_ENV || 'development';
    const preset = PRESETS[env] || PRESETS.development;

    // 환경변수 오버라이드
    const config = {
        usb: {
            enabled: parseBool(process.env.DISCOVERY_USB_ENABLED, preset.usb.enabled),
            pollIntervalMs: parseInt(process.env.DISCOVERY_USB_POLL_INTERVAL) || preset.usb.pollIntervalMs
        },
        wifi: {
            enabled: parseBool(process.env.DISCOVERY_WIFI_ENABLED, preset.wifi.enabled),
            knownDevices: parseList(process.env.DISCOVERY_WIFI_KNOWN_DEVICES) || preset.wifi.knownDevices,
            subnetScan: {
                enabled: parseBool(process.env.DISCOVERY_WIFI_SUBNET_SCAN_ENABLED, false),
                subnets: parseList(process.env.DISCOVERY_WIFI_SUBNETS) || [],
                port: parseInt(process.env.DISCOVERY_WIFI_PORT) || 5555,
                timeoutMs: parseInt(process.env.DISCOVERY_WIFI_SCAN_TIMEOUT) || 1000,
                concurrency: parseInt(process.env.DISCOVERY_WIFI_SCAN_CONCURRENCY) || 50
            }
        },
        lan: {
            enabled: parseBool(process.env.DISCOVERY_LAN_ENABLED, preset.lan.enabled),
            fixedDevices: parseList(process.env.DISCOVERY_LAN_DEVICES) || preset.lan.fixedDevices
        },
        scanIntervalMs: parseInt(process.env.DISCOVERY_SCAN_INTERVAL) || preset.scanIntervalMs,
        connectionTimeoutMs: parseInt(process.env.DISCOVERY_CONNECTION_TIMEOUT) || preset.connectionTimeoutMs,
        healthCheckIntervalMs: parseInt(process.env.DISCOVERY_HEALTH_CHECK_INTERVAL) || preset.healthCheckIntervalMs
    };

    return config;
}

/**
 * Boolean 파싱
 */
function parseBool(value, defaultValue) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return value === 'true' || value === '1';
}

/**
 * 쉼표 구분 리스트 파싱
 */
function parseList(value) {
    if (!value || value.trim() === '') {
        return null;
    }
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

module.exports = {
    loadDiscoveryConfig,
    PRESETS
};

