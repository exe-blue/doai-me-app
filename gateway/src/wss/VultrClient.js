/**
 * Vultr WSS Client
 * Protocol v1.0 - cloud-gateway 연결
 * 
 * 기존 gateway에 통합되어:
 * - Vultr 서버와 WSS 연결
 * - COMMAND 수신 → ADB/Laixi로 실행
 * - RESULT 전송
 * 
 * "복잡한 생각은 버려라." - Orion
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const crypto = require('crypto');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// Constants
// ============================================================

const PROTOCOL_VERSION = '1.0';
const DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30초
const DEFAULT_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;

const CONNECTION_STATE = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING'
};

// ============================================================
// VultrClient Class
// ============================================================

class VultrClient extends EventEmitter {
    /**
     * @param {Object} options
     * @param {string} options.nodeId - 노드 식별자
     * @param {string} options.vultrUrl - Vultr WSS URL
     * @param {string} options.secretKey - HMAC 시크릿 키 (Base64)
     * @param {Object} options.logger - 로거 인스턴스
     * @param {number} options.heartbeatInterval - 하트비트 간격 (ms)
     */
    constructor(options = {}) {
        super();
        
        this.nodeId = options.nodeId || `node_${os.hostname()}`;
        this.vultrUrl = options.vultrUrl || 'ws://localhost:8000/ws/node';
        this.secretKey = options.secretKey || '';
        this.logger = options.logger || console;
        this.heartbeatInterval = options.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
        
        this._ws = null;
        this._state = CONNECTION_STATE.DISCONNECTED;
        this._sessionId = null;
        this._heartbeatTimer = null;
        this._reconnectDelay = DEFAULT_RECONNECT_DELAY;
        this._reconnectTimer = null;
        this._running = false;
        
        // 상태
        this.status = 'READY';
        this.activeTasks = 0;
        
        // 디바이스 스냅샷 프로바이더 (외부에서 주입)
        this._deviceSnapshotProvider = null;
        
        // 명령 핸들러 (외부에서 주입)
        this._commandHandler = null;
    }
    
    // ============================================================
    // Configuration
    // ============================================================
    
    /**
     * 디바이스 스냅샷 프로바이더 설정
     * @param {Function} provider - () => Promise<Array>
     */
    setDeviceSnapshotProvider(provider) {
        this._deviceSnapshotProvider = provider;
    }
    
    /**
     * 명령 핸들러 설정
     * @param {Function} handler - (command) => Promise<result>
     */
    setCommandHandler(handler) {
        this._commandHandler = handler;
    }
    
    // ============================================================
    // Connection
    // ============================================================
    
    get isConnected() {
        return this._state === CONNECTION_STATE.CONNECTED &&
               this._ws &&
               this._ws.readyState === WebSocket.OPEN;
    }
    
    get state() {
        return this._state;
    }
    
    /**
     * Vultr 서버에 연결
     */
    async connect() {
        if (this._state === CONNECTION_STATE.CONNECTING) {
            return new Promise((resolve, reject) => {
                this.once('connected', () => resolve(true));
                this.once('error', reject);
            });
        }
        
        if (this.isConnected) {
            this.logger.info('[VultrClient] 이미 연결됨');
            return true;
        }
        
        this._state = CONNECTION_STATE.CONNECTING;
        this.logger.info(`[VultrClient] 연결 시도: ${this.vultrUrl}`);
        
        return new Promise((resolve, reject) => {
            try {
                this._ws = new WebSocket(this.vultrUrl);
                
                const connectTimeout = setTimeout(() => {
                    if (this._state === CONNECTION_STATE.CONNECTING) {
                        this._ws.terminate();
                        reject(new Error('연결 타임아웃'));
                    }
                }, 10000);
                
                this._ws.on('open', async () => {
                    clearTimeout(connectTimeout);
                    
                    try {
                        // HELLO 전송
                        await this._sendHello();
                        
                        this._state = CONNECTION_STATE.CONNECTED;
                        this._reconnectDelay = DEFAULT_RECONNECT_DELAY;
                        
                        this.logger.info(`[VultrClient] ✅ 연결 성공 (session=${this._sessionId})`);
                        this.emit('connected', { sessionId: this._sessionId });
                        
                        // 하트비트 시작
                        this._startHeartbeat();
                        
                        resolve(true);
                    } catch (err) {
                        this.logger.error('[VultrClient] HELLO 실패', err);
                        reject(err);
                    }
                });
                
                this._ws.on('message', (data) => this._handleMessage(data));
                
                this._ws.on('close', (code, reason) => {
                    clearTimeout(connectTimeout);
                    this._handleClose(code, reason);
                });
                
                this._ws.on('error', (err) => {
                    clearTimeout(connectTimeout);
                    this.logger.error('[VultrClient] WebSocket 에러', err);
                    
                    if (this._state === CONNECTION_STATE.CONNECTING) {
                        reject(err);
                    }
                });
                
            } catch (err) {
                this.logger.error('[VultrClient] 연결 실패', err);
                this._state = CONNECTION_STATE.DISCONNECTED;
                reject(err);
            }
        });
    }
    
    /**
     * 연결 해제
     */
    disconnect() {
        this._running = false;
        this._stopHeartbeat();
        this._clearReconnect();
        
        if (this._ws) {
            this._ws.close(1000, 'Client disconnect');
            this._ws = null;
        }
        
        this._state = CONNECTION_STATE.DISCONNECTED;
        this.logger.info('[VultrClient] 연결 해제됨');
        this.emit('disconnected');
    }
    
    /**
     * 자동 재연결 실행 루프
     */
    async run() {
        this._running = true;
        
        while (this._running) {
            if (!this.isConnected) {
                try {
                    await this.connect();
                } catch (err) {
                    this.logger.warn(`[VultrClient] 재연결 대기 ${this._reconnectDelay / 1000}초...`);
                    await this._sleep(this._reconnectDelay);
                    
                    // 지수 백오프
                    this._reconnectDelay = Math.min(
                        this._reconnectDelay * 2,
                        MAX_RECONNECT_DELAY
                    );
                    continue;
                }
            }
            
            // 연결 유지 대기
            await new Promise(resolve => {
                this.once('disconnected', resolve);
            });
            
            if (this._running) {
                this._state = CONNECTION_STATE.RECONNECTING;
            }
        }
    }
    
    // ============================================================
    // Message Handling
    // ============================================================
    
    _handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            const msgType = message.type;
            const payload = message.payload || {};
            
            switch (msgType) {
                case 'HELLO_ACK':
                    this._sessionId = message.session_id;
                    break;
                    
                case 'HEARTBEAT_ACK':
                    // 서버 시간 동기화 등
                    break;
                    
                case 'COMMAND':
                    this._handleCommand(payload);
                    break;
                    
                case 'ERROR':
                    this.logger.error('[VultrClient] 서버 에러:', payload);
                    this.emit('server_error', payload);
                    break;
                    
                default:
                    this.logger.debug('[VultrClient] 알 수 없는 메시지:', msgType);
            }
            
        } catch (err) {
            this.logger.error('[VultrClient] 메시지 파싱 실패', err);
        }
    }
    
    async _handleCommand(command) {
        const commandId = command.command_id;
        const commandType = command.command_type;
        
        this.logger.info(`[VultrClient] 📥 COMMAND 수신: ${commandType} (id=${commandId})`);
        
        // 상태 변경
        this.status = 'BUSY';
        this.activeTasks++;
        
        try {
            let result;
            
            if (this._commandHandler) {
                // 외부 핸들러 사용
                result = await this._commandHandler(command);
            } else {
                // 기본 핸들러
                this.logger.warn('[VultrClient] 명령 핸들러 없음, 기본 응답');
                result = {
                    status: 'SUCCESS',
                    device_results: []
                };
            }
            
            // RESULT 전송
            await this._sendResult(commandId, result.status, result.device_results);
            this.logger.info(`[VultrClient] 📤 RESULT 전송: ${result.status}`);
            
        } catch (err) {
            this.logger.error('[VultrClient] 명령 실행 실패', err);
            await this._sendResult(commandId, 'FAILED', [], err.message);
            
        } finally {
            this.activeTasks--;
            if (this.activeTasks === 0) {
                this.status = 'READY';
            }
        }
    }
    
    _handleClose(code, reason) {
        this._stopHeartbeat();
        
        const reasonStr = reason?.toString() || 'Unknown';
        this.logger.info(`[VultrClient] 연결 종료: code=${code}, reason=${reasonStr}`);
        
        this._state = CONNECTION_STATE.DISCONNECTED;
        this.emit('disconnected', { code, reason: reasonStr });
    }
    
    // ============================================================
    // Message Sending
    // ============================================================
    
    _buildMessage(type, payload) {
        return {
            version: PROTOCOL_VERSION,
            timestamp: new Date().toISOString(),
            message_id: uuidv4(),
            type,
            node_id: this.nodeId,
            payload
        };
    }
    
    _generateSignature(payload) {
        if (!this.secretKey) return '';
        
        const payloadStr = JSON.stringify(payload, Object.keys(payload).sort());
        const keyBuffer = Buffer.from(this.secretKey, 'base64');
        
        return crypto
            .createHmac('sha256', keyBuffer)
            .update(payloadStr)
            .digest('hex');
    }
    
    async _send(message) {
        if (!this.isConnected) {
            throw new Error('연결되지 않음');
        }
        
        // 서명 추가
        if (this.secretKey && message.payload) {
            message.signature = this._generateSignature(message.payload);
        }
        
        this._ws.send(JSON.stringify(message));
    }
    
    async _sendHello() {
        const deviceSnapshot = await this._getDeviceSnapshot();
        const resources = this._getSystemResources();
        
        const payload = {
            hostname: os.hostname(),
            ip_address: this._getLocalIP(),
            runner_version: '2.0.0',
            device_count: deviceSnapshot.length,
            capabilities: ['youtube', 'adb_control'],
            resources
        };
        
        const message = this._buildMessage('HELLO', payload);
        await this._send(message);
        
        // HELLO_ACK 대기
        return new Promise((resolve, reject) => {
            let timeoutId;
            
            const handler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.type === 'HELLO_ACK') {
                        clearTimeout(timeoutId);
                        this._ws.off('message', handler);
                        this._sessionId = response.session_id;
                        resolve(response);
                    } else if (response.type === 'ERROR') {
                        clearTimeout(timeoutId);
                        this._ws.off('message', handler);
                        reject(new Error(response.payload?.error_message || 'HELLO 실패'));
                    }
                } catch (err) {
                    // 파싱 에러 무시
                }
            };
            
            timeoutId = setTimeout(() => {
                // 타임아웃 시 핸들러 제거하여 메모리 누수 방지
                this._ws.off('message', handler);
                reject(new Error('HELLO_ACK 타임아웃'));
            }, 10000);
            
            this._ws.on('message', handler);
        });
    }
    
    async _sendHeartbeat() {
        const deviceSnapshot = await this._getDeviceSnapshot();
        const resources = this._getSystemResources();
        
        const payload = {
            status: this.status,
            active_tasks: this.activeTasks,
            queue_depth: 0,
            resources,
            device_snapshot: deviceSnapshot
        };
        
        const message = this._buildMessage('HEARTBEAT', payload);
        await this._send(message);
    }
    
    async _sendResult(commandId, status, deviceResults, error = null) {
        const total = deviceResults.length;
        const success = deviceResults.filter(r => r.status === 'SUCCESS').length;
        const failed = deviceResults.filter(r => r.status === 'FAILED').length;
        
        const payload = {
            command_id: commandId,
            status,
            summary: {
                total_devices: total,
                success_count: success,
                failed_count: failed,
                skipped_count: total - success - failed
            },
            device_results: deviceResults,
            execution_time_ms: 0
        };
        
        if (error) {
            payload.error_message = error;
        }
        
        const message = this._buildMessage('RESULT', payload);
        await this._send(message);
    }
    
    // ============================================================
    // Heartbeat
    // ============================================================
    
    _startHeartbeat() {
        this._stopHeartbeat();
        
        this._heartbeatTimer = setInterval(async () => {
            if (!this.isConnected) {
                this._stopHeartbeat();
                return;
            }
            
            try {
                await this._sendHeartbeat();
                this.logger.debug('[VultrClient] 💓 HEARTBEAT 전송');
            } catch (err) {
                this.logger.error('[VultrClient] HEARTBEAT 실패', err);
            }
        }, this.heartbeatInterval);
        
        this.logger.debug(`[VultrClient] 하트비트 시작 (간격: ${this.heartbeatInterval}ms)`);
    }
    
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }
    
    _clearReconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }
    
    // ============================================================
    // Utilities
    // ============================================================
    
    async _getDeviceSnapshot() {
        if (this._deviceSnapshotProvider) {
            try {
                return await this._deviceSnapshotProvider();
            } catch (err) {
                this.logger.warn('[VultrClient] 디바이스 스냅샷 조회 실패', err);
            }
        }
        return [];
    }
    
    _getSystemResources() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        return {
            cpu_percent: cpus.length > 0 ? 
                Math.round((1 - os.loadavg()[0] / cpus.length) * 100) : 0,
            memory_percent: Math.round((1 - freeMem / totalMem) * 100),
            disk_percent: 0 // TODO: disk 사용량
        };
    }
    
    _getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name in interfaces) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }
    
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = VultrClient;
module.exports.CONNECTION_STATE = CONNECTION_STATE;

