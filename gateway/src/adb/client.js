/**
 * ADB Client Wrapper
 * @devicefarmer/adbkit v3 래퍼
 * 
 * @author Axon (Tech Lead)
 * @version 1.2.0
 */

const Adb = require('@devicefarmer/adbkit');

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
            // adbkit v3: Adb.default.createClient() 사용
            if (Adb.default && Adb.Adb) {
                this.client = Adb.Adb.createClient();
            } else if (typeof Adb.createClient === 'function') {
                this.client = Adb.createClient();
            } else {
                throw new Error('Cannot find createClient in adbkit');
            }
            
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
     * DeviceClient 인스턴스 반환
     */
    getDevice(serial) {
        return this.client.getDevice(serial);
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
            const device = this.client.getDevice(serial);
            const state = await device.getState();
            return state;
        } catch (e) {
            this.logger.warn('[ADB] 기기 상태 확인 실패', { serial, error: e.message });
            return null;
        }
    }

    /**
     * Shell 명령 실행
     * adbkit v3: client.getDevice(serial).shell(command)
     */
    async shell(serial, command) {
        try {
            const device = this.client.getDevice(serial);
            const stream = await device.shell(command);
            const output = await this._readStream(stream);
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
     * 스트림 읽기 유틸리티
     */
    async _readStream(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    /**
     * 기기 추적기 생성
     */
    trackDevices() {
        return this.client.trackDevices();
    }
    
    /**
     * WiFi ADB 연결
     */
    async connect(host) {
        try {
            const id = await this.client.connect(host);
            this.logger.info('[ADB] 연결 성공', { host, id });
            return id;
        } catch (e) {
            this.logger.warn('[ADB] 연결 실패', { host, error: e.message });
            throw e;
        }
    }
    
    /**
     * 연결 해제
     */
    async disconnect(host) {
        try {
            await this.client.disconnect(host);
            this.logger.info('[ADB] 연결 해제', { host });
        } catch (e) {
            this.logger.warn('[ADB] 연결 해제 실패', { host, error: e.message });
        }
    }
    
    /**
     * 스크린샷
     */
    async screenshot(serial) {
        try {
            const device = this.client.getDevice(serial);
            const stream = await device.screencap();
            return await this._readStream(stream);
        } catch (e) {
            this.logger.error('[ADB] 스크린샷 실패', { serial, error: e.message });
            throw e;
        }
    }
}

module.exports = AdbClient;
