/**
 * Device Tracker
 * 기기 연결 상태 추적
 * 
 * Aria 명세서 기준:
 * - EventEmitter 기반 실시간 감지
 * - Events: 'add' (연결), 'remove' (해제)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const EventEmitter = require('events');

/**
 * 기기 상태
 */
const DeviceStatus = {
    HEALTHY: 'HEALTHY',
    SUSPECTED: 'SUSPECTED',
    ZOMBIE: 'ZOMBIE',
    DISCONNECTED: 'DISCONNECTED',
    RECOVERING: 'RECOVERING',
    REINITIALIZING: 'REINITIALIZING',
    VERIFYING: 'VERIFYING'
};

class DeviceTracker extends EventEmitter {
    constructor(logger, adbClient) {
        super();
        this.logger = logger;
        this.adbClient = adbClient;
        this.tracker = null;
        this.devices = new Map(); // serial -> DeviceInfo
    }

    /**
     * 기기 추적 시작
     */
    async startTracking() {
        try {
            // 초기 기기 목록 로드
            const initialDevices = await this.adbClient.listDevices();
            for (const device of initialDevices) {
                this._addDevice(device);
            }
            
            this.logger.info('[Tracker] 초기 기기 로드', { 
                count: initialDevices.length 
            });

            // 추적 시작
            this.tracker = await this.adbClient.trackDevices();

            this.tracker.on('add', (device) => {
                this._addDevice(device);
                this.emit('add', this.devices.get(device.id));
            });

            this.tracker.on('remove', (device) => {
                const deviceInfo = this.devices.get(device.id);
                this._removeDevice(device.id);
                this.emit('remove', deviceInfo || { id: device.id });
            });

            this.tracker.on('change', (device) => {
                this._updateDevice(device);
                this.emit('change', this.devices.get(device.id));
            });

            this.tracker.on('end', () => {
                this.logger.warn('[Tracker] 추적 종료됨');
                this.emit('end');
            });

            this.tracker.on('error', (err) => {
                this.logger.error('[Tracker] 오류', { error: err.message });
                this.emit('error', err);
            });

            this.logger.info('[Tracker] 추적 시작');

        } catch (e) {
            this.logger.error('[Tracker] 추적 시작 실패', { error: e.message });
            throw e;
        }
    }

    /**
     * 기기 추적 중지
     */
    async stopTracking() {
        if (this.tracker) {
            this.tracker.end();
            this.tracker = null;
            this.logger.info('[Tracker] 추적 중지');
        }
    }

    /**
     * 기기 추가
     */
    _addDevice(device) {
        const deviceInfo = {
            id: device.id,
            type: device.type,
            status: DeviceStatus.HEALTHY,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            metadata: {},
            taskCount: 0,
            errorCount: 0
        };

        this.devices.set(device.id, deviceInfo);
        this.logger.debug('[Tracker] 기기 추가', { serial: device.id });
    }

    /**
     * 기기 제거
     */
    _removeDevice(serial) {
        const device = this.devices.get(serial);
        if (device) {
            device.status = DeviceStatus.DISCONNECTED;
            device.disconnectedAt = Date.now();
        }
        this.devices.delete(serial);
        this.logger.debug('[Tracker] 기기 제거', { serial });
    }

    /**
     * 기기 업데이트
     */
    _updateDevice(device) {
        const deviceInfo = this.devices.get(device.id);
        if (deviceInfo) {
            deviceInfo.type = device.type;
            deviceInfo.lastSeen = Date.now();
        }
    }

    /**
     * 기기 정보 조회
     */
    getDevice(serial) {
        return this.devices.get(serial) || null;
    }

    /**
     * 모든 기기 조회
     */
    getAllDevices() {
        return Array.from(this.devices.values());
    }

    /**
     * 연결된 기기 수
     */
    getDeviceCount() {
        return this.devices.size;
    }

    /**
     * 건강한 기기만 조회
     */
    getHealthyDevices() {
        return this.getAllDevices().filter(d => d.status === DeviceStatus.HEALTHY);
    }

    /**
     * 기기 상태 업데이트
     */
    setDeviceStatus(serial, status) {
        const device = this.devices.get(serial);
        if (device) {
            device.status = status;
            device.lastSeen = Date.now();
            this.logger.debug('[Tracker] 상태 업데이트', { serial, status });
        }
    }

    /**
     * 기기 heartbeat 업데이트
     */
    updateHeartbeat(serial) {
        const device = this.devices.get(serial);
        if (device) {
            device.lastSeen = Date.now();
            device.status = DeviceStatus.HEALTHY;
        }
    }

    /**
     * 기기 에러 카운트 증가
     */
    incrementErrorCount(serial) {
        const device = this.devices.get(serial);
        if (device) {
            device.errorCount++;
        }
    }

    /**
     * 기기 에러 카운트 리셋
     */
    resetErrorCount(serial) {
        const device = this.devices.get(serial);
        if (device) {
            device.errorCount = 0;
        }
    }

    /**
     * 작업이 적은 기기 선택
     */
    selectLeastBusyDevice() {
        const healthy = this.getHealthyDevices();
        if (healthy.length === 0) return null;

        return healthy.reduce((min, d) => 
            d.taskCount < min.taskCount ? d : min
        );
    }
}

module.exports = DeviceTracker;
module.exports.DeviceStatus = DeviceStatus;

