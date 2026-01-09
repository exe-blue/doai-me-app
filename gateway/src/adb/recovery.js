/**
 * Device Recovery
 * 기기 복구 로직
 * 
 * Aria 명세서 기준:
 * - Self-Healing State Machine
 * - Zombie Mode 실행
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const { DeviceStatus } = require('./tracker');

class Recovery {
    constructor(logger, adbClient, commander) {
        this.logger = logger;
        this.adbClient = adbClient;
        this.commander = commander;
        this.recoveryQueue = new Map(); // serial -> RecoveryState
        this.maxRetries = 3;
    }

    /**
     * 필요시 복구 스케줄
     */
    scheduleIfNeeded(device) {
        // 새로 연결된 기기는 Zombie Mode 실행 필요 여부 확인
        // (재부팅된 기기인지 확인)
        this.logger.debug('[Recovery] 기기 확인', { serial: device.id });
    }

    /**
     * 복구 스케줄 등록
     */
    scheduleRecovery(serial) {
        if (this.recoveryQueue.has(serial)) {
            this.logger.debug('[Recovery] 이미 복구 대기 중', { serial });
            return;
        }

        const recoveryState = {
            serial,
            status: 'SCHEDULED',
            scheduledAt: Date.now(),
            retryCount: 0
        };

        this.recoveryQueue.set(serial, recoveryState);
        this.logger.info('[Recovery] 복구 스케줄됨', { serial });

        // 즉시 복구 시도
        this._executeRecovery(serial);
    }

    /**
     * 복구 실행
     */
    async _executeRecovery(serial) {
        const state = this.recoveryQueue.get(serial);
        if (!state) return;

        if (state.retryCount >= this.maxRetries) {
            this.logger.error('[Recovery] 최대 재시도 초과', { 
                serial, 
                retries: state.retryCount 
            });
            this.recoveryQueue.delete(serial);
            return;
        }

        state.status = 'RECOVERING';
        state.retryCount++;

        this.logger.info('[Recovery] 복구 시도', { 
            serial, 
            attempt: state.retryCount 
        });

        try {
            // 1. ADB 연결 확인
            const deviceState = await this.adbClient.getDeviceState(serial);
            
            if (!deviceState || deviceState !== 'device') {
                this.logger.warn('[Recovery] ADB 연결 없음', { serial, deviceState });
                state.status = 'DISCONNECTED';
                // 5분 후 재시도
                setTimeout(() => this._executeRecovery(serial), 5 * 60 * 1000);
                return;
            }

            // 2. Zombie Mode 실행
            state.status = 'SCRIPT_INJECT';
            const zombieResult = await this.commander.executeZombieMode(serial);

            if (!zombieResult) {
                throw new Error('Zombie Mode 실패');
            }

            // 3. Heartbeat로 검증
            state.status = 'VERIFYING';
            const heartbeatResult = await this.commander.sendHeartbeat(serial);

            if (!heartbeatResult) {
                throw new Error('Heartbeat 검증 실패');
            }

            // 4. 복구 완료
            this.logger.info('[Recovery] ✅ 복구 완료', { serial });
            this.recoveryQueue.delete(serial);

        } catch (e) {
            this.logger.error('[Recovery] 복구 실패', { 
                serial, 
                error: e.message,
                attempt: state.retryCount
            });

            // 재시도
            setTimeout(() => this._executeRecovery(serial), 30000);
        }
    }

    /**
     * 복구 취소
     */
    cancelRecovery(serial) {
        if (this.recoveryQueue.has(serial)) {
            this.recoveryQueue.delete(serial);
            this.logger.info('[Recovery] 복구 취소됨', { serial });
        }
    }

    /**
     * 복구 상태 조회
     */
    getRecoveryStatus(serial) {
        return this.recoveryQueue.get(serial) || null;
    }

    /**
     * 전체 복구 상태
     */
    getAllRecoveryStatus() {
        return Array.from(this.recoveryQueue.values());
    }
}

module.exports = Recovery;

