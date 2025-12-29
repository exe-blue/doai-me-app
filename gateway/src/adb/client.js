/**
 * ADB Client Wrapper
 * @devicefarmer/adbkit 래퍼
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const adb = require('@devicefarmer/adbkit');

class AdbClient {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.client = null;
    }

    /**
     * ADB 클라이언트 초기화
     */
    async initialize() {
        try {
            this.client = adb.createClient();
            
            // 연결 테스트
            const version = await this.client.version();
            this.logger.info('[ADB] 버전', { version });
            
            return true;
        } catch (e) {
            this.logger.error('[ADB] 초기화 실패', { error: e.message });
            throw e;
        }
    }

    /**
     * ADB 클라이언트 인스턴스 반환
     */
    getClient() {
        return this.client;
    }

    /**
     * 연결된 기기 목록
     */
    async listDevices() {
        try {
            const devices = await this.client.listDevices();
            return devices;
        } catch (e) {
            this.logger.error('[ADB] 기기 목록 조회 실패', { error: e.message });
            return [];
        }
    }

    /**
     * 기기 상태 확인
     */
    async getDeviceState(serial) {
        try {
            const state = await this.client.getState(serial);
            return state;
        } catch (e) {
            this.logger.warn('[ADB] 기기 상태 확인 실패', { serial, error: e.message });
            return null;
        }
    }

    /**
     * Shell 명령 실행
     */
    async shell(serial, command) {
        try {
            const stream = await this.client.shell(serial, command);
            const output = await adb.util.readAll(stream);
            return output.toString().trim();
        } catch (e) {
            this.logger.error('[ADB] Shell 명령 실패', { 
                serial, 
                command, 
                error: e.message 
            });
            throw e;
        }
    }

    /**
     * 기기 추적기 생성
     */
    trackDevices() {
        return this.client.trackDevices();
    }
}

module.exports = AdbClient;

