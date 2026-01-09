/**
 * Discovery Manager
 * 
 * Aria 명세서 (2025-01-15) - Dynamic Device Architecture v3.0
 * 
 * 디바이스 자동 발견 및 레지스트리 관리
 * - USB: adb devices 폴링
 * - WiFi: known IPs 연결 + 선택적 subnet scan
 * - LAN: 고정 IP 연결
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const EventEmitter = require('events');
const net = require('net');

/**
 * 연결 타입
 */
const CONNECTION_TYPES = {
    USB: 'USB',
    WIFI: 'WIFI',
    LAN: 'LAN'
};

/**
 * 디바이스 상태
 */
const DEVICE_STATUS = {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    CONNECTING: 'CONNECTING',
    ERROR: 'ERROR'
};

/**
 * 재연결 설정
 */
const RECONNECT_CONFIG = {
    maxAttempts: 3,        // 최대 재연결 시도 횟수
    intervalMs: 10000,     // 재연결 간격 (10초)
    backoffMultiplier: 1.5 // 백오프 배수
};

class DiscoveryManager extends EventEmitter {
    /**
     * @param {Object} logger - Logger 인스턴스
     * @param {Object} adbClient - ADB 클라이언트
     * @param {Object} config - 설정
     */
    constructor(logger, adbClient, config) {
        super();
        this.logger = logger;
        this.adbClient = adbClient;
        this.config = config;
        
        // 디바이스 레지스트리
        this.registry = new Map();
        
        // 재연결 상태 추적
        this.reconnectAttempts = new Map(); // serial -> { attempts, timer }
        
        // 타이머
        this.scanTimer = null;
        this.healthCheckTimer = null;
        this.usbPollTimer = null;
        
        // 스캔 상태
        this.isScanning = false;
        this.lastScanTime = null;
    }

    /**
     * 초기화
     */
    async initialize() {
        this.logger.info('[Discovery] 초기화 시작');

        // 1. 초기 전체 스캔
        await this.performFullScan();

        // 2. 주기적 스캔 스케줄링
        this.schedulePeriodicScan();

        // 3. USB 핫플러그 모니터링
        if (this.config.usb.enabled) {
            this.startUsbMonitoring();
        }

        // 4. 헬스체크 시작
        this.startHealthCheck();

        this.logger.info('[Discovery] 초기화 완료', {
            totalDevices: this.registry.size,
            config: {
                usb: this.config.usb.enabled,
                wifi: this.config.wifi.enabled,
                lan: this.config.lan.enabled
            }
        });
    }

    /**
     * 전체 스캔 수행
     */
    async performFullScan() {
        if (this.isScanning) {
            this.logger.warn('[Discovery] 스캔 진행 중, 중복 요청 무시');
            return null;
        }

        this.isScanning = true;
        const startTime = Date.now();
        const results = [];

        this.logger.info('[Discovery] 전체 스캔 시작');

        try {
            // Phase 1: USB 디바이스 스캔
            if (this.config.usb.enabled) {
                const usbDevices = await this.scanUsbDevices();
                results.push(...usbDevices);
                this.logger.debug('[Discovery] USB 스캔 완료', { count: usbDevices.length });
            }

            // Phase 2: 알려진 WiFi/LAN 디바이스 연결
            const knownIps = [
                ...this.config.wifi.knownDevices,
                ...this.config.lan.fixedDevices
            ];
            
            if (knownIps.length > 0) {
                const knownDevices = await this.connectKnownDevices(knownIps);
                results.push(...knownDevices);
                this.logger.debug('[Discovery] Known 디바이스 연결 완료', { count: knownDevices.length });
            }

            // Phase 3: 서브넷 스캔 (선택적)
            if (this.config.wifi.subnetScan?.enabled) {
                const scannedDevices = await this.scanSubnets();
                results.push(...scannedDevices);
                this.logger.debug('[Discovery] Subnet 스캔 완료', { count: scannedDevices.length });
            }

            // 레지스트리 업데이트
            this.updateRegistry(results);
            this.lastScanTime = new Date();

            const scanResult = {
                duration: Date.now() - startTime,
                totalFound: results.length,
                byType: {
                    USB: results.filter(d => d.connectionType === CONNECTION_TYPES.USB).length,
                    WIFI: results.filter(d => d.connectionType === CONNECTION_TYPES.WIFI).length,
                    LAN: results.filter(d => d.connectionType === CONNECTION_TYPES.LAN).length
                }
            };

            this.logger.info('[Discovery] 전체 스캔 완료', scanResult);
            this.emit('scan:complete', scanResult);

            return scanResult;

        } catch (e) {
            this.logger.error('[Discovery] 스캔 실패', { error: e.message });
            throw e;
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * USB 디바이스 스캔
     */
    async scanUsbDevices() {
        const devices = [];

        try {
            const adbDevices = await this.adbClient.listDevices();

            for (const d of adbDevices) {
                // 'device' 상태만 처리 ('unauthorized' 등 제외)
                if (d.type !== 'device') {
                    this.logger.debug('[Discovery] USB 디바이스 상태 비정상', { 
                        id: d.id, 
                        type: d.type 
                    });
                    continue;
                }

                // IP:PORT 형태면 WiFi로 분류
                if (d.id.includes(':')) {
                    continue;
                }

                const props = await this.getDeviceProperties(d.id);
                const displaySize = await this.getDisplaySize(d.id);

                devices.push({
                    serial: d.id,
                    connectionType: CONNECTION_TYPES.USB,
                    status: DEVICE_STATUS.ONLINE,
                    model: props['ro.product.model'] || 'Unknown',
                    androidVersion: props['ro.build.version.release'] || 'Unknown',
                    displaySize,
                    connectedAt: new Date(),
                    lastSeenAt: new Date(),
                    gatewayClientConnected: false
                });
            }

        } catch (e) {
            this.logger.warn('[Discovery] USB 스캔 오류', { error: e.message });
        }

        return devices;
    }

    /**
     * 알려진 디바이스 연결
     */
    async connectKnownDevices(ips) {
        const results = [];
        const batchSize = 20;

        for (let i = 0; i < ips.length; i += batchSize) {
            const batch = ips.slice(i, i + batchSize);
            
            const batchResults = await Promise.allSettled(
                batch.map(ip => this.connectSingleDevice(ip))
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                }
            }
        }

        return results;
    }

    /**
     * 단일 디바이스 연결
     */
    async connectSingleDevice(address) {
        const ip = address.includes(':') ? address : `${address}:5555`;

        try {
            // ADB connect 시도
            await this.adbClient.connect(ip);

            // 연결 성공 시 정보 조회
            const props = await this.getDeviceProperties(ip);
            const displaySize = await this.getDisplaySize(ip);
            const connectionType = this.detectConnectionType(address);

            return {
                serial: ip,
                connectionType,
                status: DEVICE_STATUS.ONLINE,
                model: props['ro.product.model'] || 'Unknown',
                androidVersion: props['ro.build.version.release'] || 'Unknown',
                displaySize,
                connectedAt: new Date(),
                lastSeenAt: new Date(),
                gatewayClientConnected: false
            };

        } catch (e) {
            this.logger.debug('[Discovery] 디바이스 연결 실패', { 
                address, 
                error: e.message 
            });
            return null;
        }
    }

    /**
     * 서브넷 스캔
     */
    async scanSubnets() {
        const { subnets, port, timeoutMs, concurrency } = this.config.wifi.subnetScan;
        const results = [];

        for (const subnet of subnets) {
            const ips = this.expandSubnet(subnet);
            
            // TCP 포트 스캔
            const openPorts = await this.tcpScan(ips, port, timeoutMs, concurrency);
            
            // 열린 포트에 ADB 연결
            for (const ip of openPorts) {
                const device = await this.connectSingleDevice(`${ip}:${port}`);
                if (device) {
                    results.push(device);
                }
            }
        }

        return results;
    }

    /**
     * TCP 포트 스캔
     */
    async tcpScan(ips, port, timeoutMs, concurrency) {
        const openPorts = [];
        
        for (let i = 0; i < ips.length; i += concurrency) {
            const batch = ips.slice(i, i + concurrency);
            
            const results = await Promise.allSettled(
                batch.map(ip => this.checkPort(ip, port, timeoutMs))
            );

            for (let j = 0; j < results.length; j++) {
                if (results[j].status === 'fulfilled' && results[j].value) {
                    openPorts.push(batch[j]);
                }
            }
        }

        return openPorts;
    }

    /**
     * 포트 열림 확인
     */
    checkPort(ip, port, timeoutMs) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            
            socket.setTimeout(timeoutMs);
            
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.connect(port, ip);
        });
    }

    /**
     * 서브넷 확장 (CIDR → IP 리스트)
     */
    expandSubnet(cidr) {
        const [base, bits] = cidr.split('/');
        const mask = parseInt(bits) || 24;
        const parts = base.split('.').map(Number);
        
        const baseNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        const hostBits = 32 - mask;
        const numHosts = Math.pow(2, hostBits) - 2; // 네트워크/브로드캐스트 제외
        
        const ips = [];
        for (let i = 1; i <= numHosts; i++) {
            const ipNum = baseNum + i;
            const ip = [
                (ipNum >> 24) & 255,
                (ipNum >> 16) & 255,
                (ipNum >> 8) & 255,
                ipNum & 255
            ].join('.');
            ips.push(ip);
        }
        
        return ips;
    }

    /**
     * 연결 타입 감지
     */
    detectConnectionType(address) {
        // LAN 고정 디바이스에 있으면 LAN
        if (this.config.lan.fixedDevices.some(d => address.startsWith(d.split(':')[0]))) {
            return CONNECTION_TYPES.LAN;
        }
        // IP 형태면 WiFi
        if (address.includes('.')) {
            return CONNECTION_TYPES.WIFI;
        }
        return CONNECTION_TYPES.USB;
    }

    /**
     * 디바이스 속성 조회
     */
    async getDeviceProperties(serial) {
        try {
            const props = {};
            const output = await this.adbClient.shell(serial, 'getprop');
            
            const lines = output.toString().split('\n');
            for (const line of lines) {
                const match = line.match(/\[([^\]]+)\]: \[([^\]]*)\]/);
                if (match) {
                    props[match[1]] = match[2];
                }
            }
            
            return props;
        } catch (e) {
            return {};
        }
    }

    /**
     * 화면 해상도 조회
     */
    async getDisplaySize(serial) {
        try {
            const output = await this.adbClient.shell(serial, 'wm size');
            const match = output.toString().match(/(\d+)x(\d+)/);
            
            if (match) {
                return {
                    width: parseInt(match[1]),
                    height: parseInt(match[2])
                };
            }
        } catch (e) {
            // 무시
        }
        
        // 기본값 (Galaxy S9)
        return { width: 1440, height: 2960 };
    }

    /**
     * 레지스트리 업데이트
     */
    updateRegistry(scannedDevices) {
        const scannedSerials = new Set(scannedDevices.map(d => d.serial));
        let added = 0, removed = 0, updated = 0;

        // 새로 발견된 디바이스
        for (const device of scannedDevices) {
            const existing = this.registry.get(device.serial);

            if (!existing) {
                // 신규 디바이스
                this.registry.set(device.serial, device);
                this.emit('device:added', device);
                this.cancelReconnect(device.serial); // 재연결 시도 취소
                added++;
            } else if (existing.status !== device.status) {
                // 상태 변경
                this.registry.set(device.serial, { ...existing, ...device });
                this.emit('device:changed', device);
                
                // ONLINE으로 변경되면 재연결 시도 취소
                if (device.status === DEVICE_STATUS.ONLINE) {
                    this.cancelReconnect(device.serial);
                }
                
                updated++;
            } else {
                // lastSeenAt 업데이트
                existing.lastSeenAt = new Date();
            }
        }

        // 사라진 디바이스 - 재연결 시도 시작
        for (const [serial, device] of this.registry) {
            if (!scannedSerials.has(serial) && device.status === DEVICE_STATUS.ONLINE) {
                device.status = DEVICE_STATUS.OFFLINE;
                this.emit('device:removed', device);
                removed++;
                
                // WiFi/LAN 디바이스만 재연결 시도 (USB는 물리적 분리)
                if (device.connectionType !== CONNECTION_TYPES.USB) {
                    this.scheduleReconnect(device);
                }
            }
        }

        this.logger.debug('[Discovery] 레지스트리 업데이트', { added, removed, updated });
    }
    
    /**
     * 디바이스 재연결 스케줄링
     * @param {Object} device - 재연결할 디바이스
     */
    scheduleReconnect(device) {
        const serial = device.serial;
        
        // 이미 재연결 중이면 무시
        if (this.reconnectAttempts.has(serial)) {
            return;
        }
        
        this.logger.info(`[Discovery] 재연결 스케줄링: ${serial}`);
        
        const state = {
            attempts: 0,
            timer: null,
            device
        };
        
        this.reconnectAttempts.set(serial, state);
        
        // 즉시 첫 번째 재연결 시도
        this.attemptReconnect(serial);
    }
    
    /**
     * 재연결 시도 실행
     * @param {string} serial - 디바이스 시리얼
     */
    async attemptReconnect(serial) {
        const state = this.reconnectAttempts.get(serial);
        if (!state) return;
        
        state.attempts++;
        
        this.logger.info(`[Discovery] 재연결 시도 ${state.attempts}/${RECONNECT_CONFIG.maxAttempts}: ${serial}`);
        
        try {
            // ADB 연결 시도
            const result = await this.connectSingleDevice(serial);
            
            if (result) {
                // 성공
                this.logger.info(`[Discovery] 재연결 성공: ${serial}`);
                this.cancelReconnect(serial);
                
                // 레지스트리 업데이트 - 재연결은 'changed'로 emit (중복 초기화 방지)
                this.registry.set(serial, result);
                this.emit('device:changed', result);
                this.emit('device:reconnected', result);
                return;
            }
        } catch (e) {
            this.logger.warn(`[Discovery] 재연결 실패: ${serial}`, { error: e.message });
        }
        
        // 실패 - 다음 시도 스케줄링
        if (state.attempts < RECONNECT_CONFIG.maxAttempts) {
            const delay = RECONNECT_CONFIG.intervalMs * Math.pow(RECONNECT_CONFIG.backoffMultiplier, state.attempts - 1);
            this.logger.info(`[Discovery] 다음 재연결 ${Math.round(delay / 1000)}초 후: ${serial}`);
            
            state.timer = setTimeout(() => {
                this.attemptReconnect(serial);
            }, delay);
        } else {
            // 최대 시도 횟수 초과
            this.logger.warn(`[Discovery] 재연결 포기 (최대 시도 초과): ${serial}`);
            this.reconnectAttempts.delete(serial);
            
            // 디바이스를 ERROR 상태로 변경
            const device = this.registry.get(serial);
            if (device) {
                device.status = DEVICE_STATUS.ERROR;
                device.errorMessage = '재연결 실패 (3회 시도 후 포기)';
                this.emit('device:error', device);
            }
        }
    }
    
    /**
     * 재연결 시도 취소
     * @param {string} serial - 디바이스 시리얼
     */
    cancelReconnect(serial) {
        const state = this.reconnectAttempts.get(serial);
        if (state) {
            if (state.timer) {
                clearTimeout(state.timer);
            }
            this.reconnectAttempts.delete(serial);
            this.logger.debug(`[Discovery] 재연결 취소: ${serial}`);
        }
    }
    
    /**
     * 수동 재연결 요청
     * @param {string} serial - 디바이스 시리얼
     */
    async manualReconnect(serial) {
        const device = this.registry.get(serial);
        if (!device) {
            throw new Error(`디바이스를 찾을 수 없음: ${serial}`);
        }
        
        // 기존 재연결 시도 취소
        this.cancelReconnect(serial);
        
        // 새로운 재연결 시도
        this.scheduleReconnect(device);
        
        return { message: '재연결 시도 시작됨', serial };
    }

    /**
     * 주기적 스캔 스케줄링
     */
    schedulePeriodicScan() {
        this.scanTimer = setInterval(async () => {
            try {
                await this.performFullScan();
            } catch (e) {
                this.logger.error('[Discovery] 주기 스캔 실패', { error: e.message });
            }
        }, this.config.scanIntervalMs);
    }

    /**
     * USB 모니터링 시작
     */
    startUsbMonitoring() {
        this.usbPollTimer = setInterval(async () => {
            try {
                const usbDevices = await this.scanUsbDevices();
                
                // USB 디바이스만 업데이트
                for (const device of usbDevices) {
                    const existing = this.registry.get(device.serial);
                    if (!existing) {
                        this.registry.set(device.serial, device);
                        this.emit('device:added', device);
                        this.logger.info('[Discovery] USB 디바이스 감지', { serial: device.serial });
                    }
                }
                
            } catch (e) {
                // 무시
            }
        }, this.config.usb.pollIntervalMs);
    }

    /**
     * 헬스체크 시작
     */
    startHealthCheck() {
        this.healthCheckTimer = setInterval(async () => {
            for (const [serial, device] of this.registry) {
                if (device.status !== DEVICE_STATUS.ONLINE) continue;

                try {
                    // 간단한 ping (shell echo)
                    await this.adbClient.shell(serial, 'echo ping');
                    device.lastSeenAt = new Date();
                } catch (e) {
                    device.status = DEVICE_STATUS.OFFLINE;
                    this.emit('device:changed', device);
                    this.logger.warn('[Discovery] 헬스체크 실패', { serial });
                }
            }
        }, this.config.healthCheckIntervalMs);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * 모든 디바이스 조회
     */
    getDevices() {
        return Array.from(this.registry.values());
    }

    /**
     * 온라인 디바이스만 조회
     */
    getOnlineDevices() {
        return this.getDevices().filter(d => d.status === DEVICE_STATUS.ONLINE);
    }

    /**
     * 디바이스 수 통계
     */
    getDeviceCount() {
        const devices = this.getDevices();
        return {
            total: devices.length,
            online: devices.filter(d => d.status === DEVICE_STATUS.ONLINE).length,
            offline: devices.filter(d => d.status === DEVICE_STATUS.OFFLINE).length,
            byType: {
                USB: devices.filter(d => d.connectionType === CONNECTION_TYPES.USB).length,
                WIFI: devices.filter(d => d.connectionType === CONNECTION_TYPES.WIFI).length,
                LAN: devices.filter(d => d.connectionType === CONNECTION_TYPES.LAN).length
            }
        };
    }

    /**
     * 단일 디바이스 조회
     */
    getDevice(serial) {
        return this.registry.get(serial);
    }

    /**
     * 수동 리스캔
     */
    async rescan() {
        return this.performFullScan();
    }

    /**
     * 디바이스 수동 추가
     */
    async addDevice(address, type = 'WIFI') {
        const device = await this.connectSingleDevice(address);
        if (device) {
            device.connectionType = type;
            this.registry.set(device.serial, device);
            this.emit('device:added', device);
            return device;
        }
        return null;
    }

    /**
     * 디바이스 수동 제거
     */
    removeDevice(serial) {
        const device = this.registry.get(serial);
        if (device) {
            this.registry.delete(serial);
            this.emit('device:removed', device);
            return true;
        }
        return false;
    }

    /**
     * Gateway 클라이언트 연결 상태 업데이트
     */
    setGatewayClientConnected(serial, connected) {
        const device = this.registry.get(serial);
        if (device) {
            device.gatewayClientConnected = connected;
            this.emit('device:changed', device);
        }
    }

    /**
     * AI 시민 ID 할당
     */
    setAiCitizenId(serial, citizenId) {
        const device = this.registry.get(serial);
        if (device) {
            device.aiCitizenId = citizenId;
            this.emit('device:changed', device);
        }
    }

    /**
     * 종료
     */
    shutdown() {
        if (this.scanTimer) clearInterval(this.scanTimer);
        if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
        if (this.usbPollTimer) clearInterval(this.usbPollTimer);
        
        this.logger.info('[Discovery] 종료');
    }
}

module.exports = DiscoveryManager;
module.exports.CONNECTION_TYPES = CONNECTION_TYPES;
module.exports.DEVICE_STATUS = DEVICE_STATUS;

