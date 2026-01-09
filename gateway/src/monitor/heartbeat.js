/**
 * Heartbeat Monitor
 * 기기 생존 확인
 * 
 * Aria 명세서 기준:
 * - Interval: 30초
 * - Timeout: 5초
 * - Failure Threshold: 3회 연속
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const EventEmitter = require('events');
const { DeviceStatus } = require('../adb/tracker');

class HeartbeatMonitor extends EventEmitter {
    constructor(logger, commander, deviceTracker) {
        super();
        this.logger = logger;
        this.commander = commander;
        this.deviceTracker = deviceTracker;
        
        this.interval = null;
        this.failureCount = new Map(); // serial -> count
        this.failureThreshold = 3;
        this.pendingResponses = new Map(); // serial -> timestamp
        this.responseTimeout = 5000; // 5초
    }

    /**
     * 모니터링 시작
     * @param {number} intervalMs - 체크 간격 (기본 30초)
     */
    start(intervalMs = 30000) {
        if (this.interval) {
            this.logger.warn('[Heartbeat] 이미 실행 중');
            return;
        }

        this.logger.info('[Heartbeat] 모니터 시작', { interval: intervalMs });

        this.interval = setInterval(() => {
            this._checkAll();
        }, intervalMs);
    }

    /**
     * 모니터링 중지
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.logger.info('[Heartbeat] 모니터 중지');
        }
    }

    /**
     * 전체 기기 체크
     */
    async _checkAll() {
        const devices = this.deviceTracker.getHealthyDevices();
        
        this.logger.debug('[Heartbeat] 체크 시작', { 
            deviceCount: devices.length 
        });

        for (const device of devices) {
            await this._checkDevice(device.id);
        }
    }

    /**
     * 개별 기기 체크
     */
    async _checkDevice(serial) {
        // 이전 응답 대기 중인지 확인
        const pendingTime = this.pendingResponses.get(serial);
        if (pendingTime) {
            const elapsed = Date.now() - pendingTime;
            if (elapsed > this.responseTimeout) {
                // 타임아웃
                this._handleFailure(serial);
            }
            return;
        }

        // Heartbeat 전송
        this.pendingResponses.set(serial, Date.now());
        
        try {
            await this.commander.sendHeartbeat(serial);
        } catch (e) {
            this.logger.warn('[Heartbeat] 전송 실패', { 
                serial, 
                error: e.message 
            });
            this._handleFailure(serial);
        }
    }

    /**
     * 응답 수신 처리
     */
    handleResponse(serial, metrics) {
        // 대기 상태 해제
        this.pendingResponses.delete(serial);
        
        // 실패 카운트 리셋
        this.failureCount.set(serial, 0);
        
        // 기기 상태 업데이트
        this.deviceTracker.updateHeartbeat(serial);
        
        this.logger.debug('[Heartbeat] 응답 수신', { serial, metrics });
        
        // 이벤트 발생
        this.emit('response', serial, metrics);
    }

    /**
     * 실패 처리
     */
    _handleFailure(serial) {
        this.pendingResponses.delete(serial);
        
        const count = (this.failureCount.get(serial) || 0) + 1;
        this.failureCount.set(serial, count);

        this.logger.warn('[Heartbeat] 실패', { 
            serial, 
            count, 
            threshold: this.failureThreshold 
        });

        if (count >= this.failureThreshold) {
            // 임계치 초과 - 타임아웃 이벤트
            this.deviceTracker.setDeviceStatus(serial, DeviceStatus.SUSPECTED);
            this.emit('timeout', serial);
            
            // 카운트 리셋
            this.failureCount.set(serial, 0);
        }
    }

    /**
     * 강제 체크 (수동)
     */
    async forceCheck(serial) {
        this.pendingResponses.delete(serial);
        this.failureCount.set(serial, 0);
        await this._checkDevice(serial);
    }
}

module.exports = HeartbeatMonitor;

