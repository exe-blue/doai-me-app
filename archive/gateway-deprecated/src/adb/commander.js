/**
 * ADB Commander
 * 기기에 명령 전송
 * 
 * Aria 명세서 기준:
 * - ADB Broadcast로 메시지 전송
 * - Intent Action: org.anthropic.doaime.COMMAND
 * - Extra Key: payload
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');

const PROTOCOL = {
    VERSION: 1,
    INTENT_ACTION: 'org.anthropic.doaime.COMMAND',
    EXTRA_KEY: 'payload'
};

// 제약사항 (Aria 명세서)
const CONSTRAINTS = {
    MAX_PAYLOAD_SIZE: 4096, // 4KB
    MIN_INTERVAL_MS: 1000,  // 기기당 최소 1초 간격
    BATCH_SIZE: 20,         // 동시 전송 최대 20기기
    TIMEOUT_MS: 5000        // 타임아웃 5초
};

class Commander {
    constructor(logger, adbClient) {
        this.logger = logger;
        this.adbClient = adbClient;
        this.lastSentTime = new Map(); // serial -> timestamp
    }

    /**
     * 메시지 전송
     * @param {string} serial - 기기 시리얼
     * @param {Object} message - Base Envelope
     * @returns {Promise<boolean>}
     */
    async send(serial, message) {
        // Rate limiting 확인
        if (!this._checkRateLimit(serial)) {
            this.logger.warn('[Commander] Rate limit 초과', { serial });
            return false;
        }

        // Payload 생성
        const envelope = this._createEnvelope(message, serial);
        
        // 크기 확인
        const payloadStr = JSON.stringify(envelope);
        if (payloadStr.length > CONSTRAINTS.MAX_PAYLOAD_SIZE) {
            this.logger.error('[Commander] Payload 크기 초과', {
                serial,
                size: payloadStr.length,
                max: CONSTRAINTS.MAX_PAYLOAD_SIZE
            });
            return false;
        }

        // ADB Broadcast 명령 생성
        const command = this._buildBroadcastCommand(payloadStr);

        try {
            this.logger.debug('[Commander] 전송', { 
                serial, 
                type: envelope.type,
                id: envelope.id
            });

            // 명령 실행
            const result = await this.adbClient.shell(serial, command);
            
            // 전송 시간 기록
            this.lastSentTime.set(serial, Date.now());

            this.logger.debug('[Commander] 전송 완료', { serial, result });
            return true;

        } catch (e) {
            this.logger.error('[Commander] 전송 실패', {
                serial,
                error: e.message
            });
            return false;
        }
    }

    /**
     * 배치 전송
     * @param {Array<string>} serials - 기기 시리얼 배열
     * @param {Object} message - 메시지 (동일)
     * @returns {Promise<Map<string, boolean>>}
     */
    async sendBatch(serials, message) {
        const results = new Map();
        
        // 배치 크기 제한
        const batch = serials.slice(0, CONSTRAINTS.BATCH_SIZE);
        
        // 병렬 전송
        const promises = batch.map(async (serial) => {
            const success = await this.send(serial, message);
            results.set(serial, success);
        });

        await Promise.all(promises);

        const successCount = Array.from(results.values()).filter(v => v).length;
        this.logger.info('[Commander] 배치 전송 완료', {
            total: batch.length,
            success: successCount
        });

        return results;
    }

    /**
     * SYSTEM 메시지 전송 (단축 메서드)
     */
    async sendSystem(serial, command, payload = {}) {
        return this.send(serial, {
            type: 'SYSTEM',
            priority: 5,
            payload: {
                command,
                ...payload
            },
            ack_required: true
        });
    }

    /**
     * Heartbeat 전송
     */
    async sendHeartbeat(serial) {
        return this.sendSystem(serial, 'HEARTBEAT', {
            heartbeat: {
                expect_response_within_ms: CONSTRAINTS.TIMEOUT_MS,
                include_metrics: true
            }
        });
    }

    /**
     * Wake 명령 전송
     */
    async sendWake(serial) {
        return this.sendSystem(serial, 'WAKE', {
            wake: {
                method: 'KEYEVENT',
                keep_awake_sec: 300
            }
        });
    }

    /**
     * Rate limit 확인
     */
    _checkRateLimit(serial) {
        const lastSent = this.lastSentTime.get(serial);
        if (!lastSent) return true;
        
        const elapsed = Date.now() - lastSent;
        return elapsed >= CONSTRAINTS.MIN_INTERVAL_MS;
    }

    /**
     * Base Envelope 생성
     */
    _createEnvelope(message, deviceId) {
        return {
            v: PROTOCOL.VERSION,
            id: message.id || uuidv4(),
            ts: Date.now(),
            type: message.type,
            priority: message.priority || 2,
            device_id: deviceId,
            payload: message.payload,
            ack_required: message.ack_required !== undefined ? message.ack_required : false,
            ttl: message.ttl || 300
        };
    }

    /**
     * ADB Broadcast 명령 생성
     */
    _buildBroadcastCommand(payloadStr) {
        // JSON을 Shell-safe하게 이스케이프
        const escaped = payloadStr
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/`/g, '\\`');

        return `am broadcast -a ${PROTOCOL.INTENT_ACTION} --es ${PROTOCOL.EXTRA_KEY} "${escaped}"`;
    }

    /**
     * Zombie Mode 스크립트 실행 (복구용)
     */
    async executeZombieMode(serial) {
        const steps = [
            // Step 1: 화면 깨우기
            { cmd: 'input keyevent KEYCODE_WAKEUP', delay: 2000 },
            // Step 2: 화면 잠금 해제
            { cmd: 'input swipe 500 1500 500 500', delay: 2000 },
            // Step 3: AutoX.js 강제 종료
            { cmd: 'am force-stop org.autojs.autoxjs.v6', delay: 3000 },
            // Step 4: AutoX.js 시작
            { cmd: 'am start -n org.autojs.autoxjs.v6/.ui.main.MainActivity', delay: 3000 },
            // Step 5: 메인 스크립트 실행
            { cmd: 'am broadcast -a org.autojs.autoxjs.ACTION_RUN_SCRIPT --es path "/sdcard/doai/main_v2.js"', delay: 5000 }
        ];

        this.logger.info('[Commander] Zombie Mode 실행', { serial });

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            
            try {
                this.logger.debug(`[Commander] Zombie Step ${i + 1}`, { 
                    serial, 
                    cmd: step.cmd.substring(0, 50) 
                });
                
                await this.adbClient.shell(serial, step.cmd);
                await this._delay(step.delay);
                
            } catch (e) {
                this.logger.error(`[Commander] Zombie Step ${i + 1} 실패`, {
                    serial,
                    error: e.message
                });
                return false;
            }
        }

        this.logger.info('[Commander] Zombie Mode 완료', { serial });
        return true;
    }

    /**
     * 딜레이 유틸리티
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Commander;
module.exports.PROTOCOL = PROTOCOL;
module.exports.CONSTRAINTS = CONSTRAINTS;

