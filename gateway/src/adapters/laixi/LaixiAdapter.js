/**
 * Laixi Adapter - Device Control Layer
 * 
 * 오리온 지시: "신경망의 가시성을 확보해라"
 * 
 * 기능:
 * 1. Logger 미들웨어: [OUT]/[IN] 로깅
 * 2. Heartbeat: WebSocket 연결 상태 확인
 * 3. 명령 전송/수신 래퍼
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Laixi 명령 타입
 */
const LAIXI_COMMANDS = {
    LIST: 'list',
    TOAST: 'Toast',
    POINTER_EVENT: 'PointerEvent',
    ADB: 'ADB',
    BASIS_OPERATE: 'BasisOperate',
    CURRENT_APP_INFO: 'CurrentAppInfo',
    WRITE_CLIPBOARD: 'writeclipboard',
    SCREEN: 'screen'
};

/**
 * 연결 상태
 */
const CONNECTION_STATE = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    ERROR: 'ERROR'
};

class LaixiAdapter extends EventEmitter {
    /**
     * @param {Object} options
     * @param {string} options.url - WebSocket URL (기본: ws://127.0.0.1:22221/)
     * @param {number} options.timeout - 명령 타임아웃 (ms)
     * @param {number} options.heartbeatInterval - 하트비트 간격 (ms)
     * @param {number} options.reconnectInterval - 재연결 간격 (ms)
     * @param {number} options.maxReconnectAttempts - 최대 재연결 시도
     * @param {Object} options.logger - 외부 Logger (선택)
     */
    constructor(options = {}) {
        super();
        
        this.url = options.url || 'ws://127.0.0.1:22221/';
        this.timeout = options.timeout || 10000;
        this.heartbeatInterval = options.heartbeatInterval || 5000;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.externalLogger = options.logger || null;
        
        this._ws = null;
        this._state = CONNECTION_STATE.DISCONNECTED;
        this._heartbeatTimer = null;
        this._reconnectAttempts = 0;
        this._pendingRequests = new Map(); // requestId -> { resolve, reject, timer }
        this._requestIdCounter = 0;
        
        // 통계
        this._stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            reconnects: 0,
            lastHeartbeat: null
        };
    }
    
    /**
     * 연결 상태
     */
    get state() {
        return this._state;
    }
    
    /**
     * 연결 여부
     */
    get isConnected() {
        return this._state === CONNECTION_STATE.CONNECTED && 
               this._ws && 
               this._ws.readyState === WebSocket.OPEN;
    }
    
    /**
     * 통계
     */
    get stats() {
        return { ...this._stats };
    }
    
    // ==================== Logger 미들웨어 ====================
    
    /**
     * [OUT] 로그 출력
     */
    _logOut(command) {
        const timestamp = new Date().toISOString();
        const logMsg = `[OUT] Sending to Laixi: ${JSON.stringify(command)}`;
        
        console.log(`\x1b[36m${timestamp}\x1b[0m \x1b[33m${logMsg}\x1b[0m`);
        
        if (this.externalLogger) {
            this.externalLogger.info(logMsg, { direction: 'OUT', command });
        }
        
        this.emit('log:out', { timestamp, command });
    }
    
    /**
     * [IN] 로그 출력
     */
    _logIn(response, elapsed = 0) {
        const timestamp = new Date().toISOString();
        const logMsg = `[IN] Laixi replied: ${JSON.stringify(response)} (${elapsed}ms)`;
        
        console.log(`\x1b[36m${timestamp}\x1b[0m \x1b[32m${logMsg}\x1b[0m`);
        
        if (this.externalLogger) {
            this.externalLogger.info(logMsg, { direction: 'IN', response, elapsed });
        }
        
        this.emit('log:in', { timestamp, response, elapsed });
    }
    
    /**
     * [ERROR] 로그 출력
     */
    _logError(message, error = null) {
        const timestamp = new Date().toISOString();
        const logMsg = `[ERROR] ${message}${error ? ': ' + error.message : ''}`;
        
        console.error(`\x1b[36m${timestamp}\x1b[0m \x1b[31m${logMsg}\x1b[0m`);
        
        if (this.externalLogger) {
            this.externalLogger.error(logMsg, { error: error?.stack });
        }
        
        this._stats.errors++;
        this.emit('log:error', { timestamp, message, error });
    }
    
    /**
     * [INFO] 로그 출력
     */
    _logInfo(message) {
        const timestamp = new Date().toISOString();
        
        console.log(`\x1b[36m${timestamp}\x1b[0m \x1b[34m[INFO]\x1b[0m ${message}`);
        
        if (this.externalLogger) {
            this.externalLogger.info(message);
        }
        
        this.emit('log:info', { timestamp, message });
    }
    
    // ==================== 연결 관리 ====================
    
    /**
     * WebSocket 연결
     */
    async connect() {
        if (this._state === CONNECTION_STATE.CONNECTING) {
            return new Promise((resolve, reject) => {
                this.once('connected', () => resolve(true));
                this.once('error', reject);
            });
        }
        
        if (this.isConnected) {
            this._logInfo('이미 연결됨');
            return true;
        }
        
        this._state = CONNECTION_STATE.CONNECTING;
        this._logInfo(`Laixi 서버 연결 시도: ${this.url}`);
        
        return new Promise((resolve, reject) => {
            try {
                this._ws = new WebSocket(this.url);
                
                const connectTimeout = setTimeout(() => {
                    if (this._state === CONNECTION_STATE.CONNECTING) {
                        this._ws.terminate();
                        const err = new Error('연결 타임아웃');
                        this._logError('연결 타임아웃', err);
                        reject(err);
                    }
                }, this.timeout);
                
                this._ws.on('open', () => {
                    clearTimeout(connectTimeout);
                    this._state = CONNECTION_STATE.CONNECTED;
                    this._reconnectAttempts = 0;
                    
                    // ✨ Connected 로그
                    console.log('\x1b[32m========================================\x1b[0m');
                    console.log('\x1b[32m  ✅ Connected to Laixi Server         \x1b[0m');
                    console.log(`\x1b[32m     URL: ${this.url}                  \x1b[0m`);
                    console.log('\x1b[32m========================================\x1b[0m');
                    
                    this._logInfo('Laixi 연결 성공');
                    this.emit('connected');
                    
                    // 하트비트 시작
                    this._startHeartbeat();
                    
                    resolve(true);
                });
                
                this._ws.on('message', (data) => {
                    this._handleMessage(data);
                });
                
                this._ws.on('close', (code, reason) => {
                    clearTimeout(connectTimeout);
                    this._handleClose(code, reason);
                });
                
                this._ws.on('error', (err) => {
                    clearTimeout(connectTimeout);
                    this._logError('WebSocket 오류', err);
                    
                    if (this._state === CONNECTION_STATE.CONNECTING) {
                        reject(err);
                    }
                });
                
            } catch (err) {
                this._logError('연결 실패', err);
                this._state = CONNECTION_STATE.ERROR;
                reject(err);
            }
        });
    }
    
    /**
     * 연결 해제
     */
    disconnect() {
        this._stopHeartbeat();
        
        // 대기 중인 요청 모두 거부
        for (const [requestId, pending] of this._pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('연결 해제됨'));
        }
        this._pendingRequests.clear();
        
        if (this._ws) {
            this._ws.close(1000, 'Client disconnect');
            this._ws = null;
        }
        
        this._state = CONNECTION_STATE.DISCONNECTED;
        this._logInfo('Laixi 연결 해제됨');
        this.emit('disconnected');
    }
    
    /**
     * 메시지 수신 처리
     * 
     * ⚠️ 제한사항: Laixi 서버는 _requestId를 반환하지 않으므로,
     * FIFO 방식으로 가장 오래된 pending request에 응답을 매칭합니다.
     * 
     * 이 방식은 네트워크 재정렬이나 동시 heartbeat/command 상황에서
     * 응답이 잘못된 요청에 매칭될 수 있습니다.
     * 
     * 권장사항:
     * - 서버에서 requestId echo를 지원하면 해당 방식 사용
     * - heartbeat와 일반 명령을 별도 pending map으로 분리 고려
     */
    _handleMessage(data) {
        const receiveTime = Date.now();
        
        try {
            const response = JSON.parse(data.toString());
            
            // Laixi는 requestId를 반환하지 않으므로, 가장 오래된 pending request에 응답
            if (this._pendingRequests.size > 0) {
                // Map은 삽입 순서를 유지하므로 첫 번째 항목이 가장 오래된 요청
                const [requestId, pending] = this._pendingRequests.entries().next().value;
                
                // FIFO fallback 사용 로그 (디버깅/모니터링용)
                this._stats.fifoFallbackCount = (this._stats.fifoFallbackCount || 0) + 1;
                if (this._stats.fifoFallbackCount % 100 === 1) {
                    this._logInfo(`⚠️ FIFO fallback 매칭 사용 중 (count: ${this._stats.fifoFallbackCount}) - requestId echo 미지원`);
                }
                
                clearTimeout(pending.timer);
                this._pendingRequests.delete(requestId);
                
                const elapsed = receiveTime - pending.startTime;
                this._logIn(response, elapsed);
                
                pending.resolve(response);
            } else {
                // 대기 중인 요청 없음 - broadcast 메시지
                this._logIn(response, 0);
                this.emit('message', response);
            }
            
            this._stats.messagesReceived++;
            
        } catch (err) {
            this._logError('메시지 파싱 실패', err);
        }
    }
    
    /**
     * 연결 종료 처리
     */
    _handleClose(code, reason) {
        this._stopHeartbeat();
        
        const reasonStr = reason?.toString() || 'Unknown';
        this._logInfo(`연결 종료: code=${code}, reason=${reasonStr}`);
        
        if (this._state !== CONNECTION_STATE.DISCONNECTED) {
            this._state = CONNECTION_STATE.DISCONNECTED;
            this.emit('disconnected', { code, reason: reasonStr });
            
            // 자동 재연결 시도
            this._attemptReconnect();
        }
    }
    
    /**
     * 재연결 시도
     */
    async _attemptReconnect() {
        if (this._reconnectAttempts >= this.maxReconnectAttempts) {
            this._logError(`최대 재연결 시도 초과 (${this.maxReconnectAttempts}회)`);
            this._state = CONNECTION_STATE.ERROR;
            this.emit('error', new Error('Max reconnect attempts exceeded'));
            return;
        }
        
        this._reconnectAttempts++;
        this._stats.reconnects++;
        this._state = CONNECTION_STATE.RECONNECTING;
        
        this._logInfo(`재연결 시도 ${this._reconnectAttempts}/${this.maxReconnectAttempts}...`);
        
        await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
        
        try {
            await this.connect();
        } catch (err) {
            // 연결 실패 시 재연결 경로 트리거
            this._logError('재연결 시도 실패', err);
            // 재연결 시도 횟수 체크 후 _attemptReconnect 재호출
            if (this._reconnectAttempts < this.maxReconnectAttempts) {
                this._attemptReconnect();
            } else {
                this._logError(`최대 재연결 시도 초과 (${this.maxReconnectAttempts}회)`);
                this._state = CONNECTION_STATE.ERROR;
                this.emit('error', new Error('Max reconnect attempts exceeded after connect failure'));
            }
        }
    }
    
    // ==================== Heartbeat (Ping-Pong) ====================
    
    /**
     * 하트비트 시작
     */
    _startHeartbeat() {
        this._stopHeartbeat();
        
        this._heartbeatTimer = setInterval(async () => {
            if (!this.isConnected) {
                this._stopHeartbeat();
                return;
            }
            
            try {
                const startTime = Date.now();
                const response = await this.sendCommand({ action: LAIXI_COMMANDS.LIST }, 3000);
                const latency = Date.now() - startTime;
                
                this._stats.lastHeartbeat = new Date().toISOString();
                
                // 심박동 성공
                console.log(`\x1b[35m💓 Heartbeat OK (${latency}ms) - Devices: ${response?.devices?.length || 0}\x1b[0m`);
                
                this.emit('heartbeat', { 
                    latency, 
                    deviceCount: response?.devices?.length || 0 
                });
                
            } catch (err) {
                console.log(`\x1b[31m💔 Heartbeat FAILED: ${err.message}\x1b[0m`);
                this.emit('heartbeat:failed', err);
            }
        }, this.heartbeatInterval);
        
        this._logInfo(`하트비트 시작 (간격: ${this.heartbeatInterval}ms)`);
    }
    
    /**
     * 하트비트 중지
     */
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }
    
    // ==================== 명령 전송 ====================
    
    /**
     * 명령 전송 (Logger 미들웨어 적용)
     * 
     * @param {Object} command - Laixi 명령 객체
     * @param {number} timeout - 타임아웃 (ms)
     * @returns {Promise<Object>} 응답
     */
    async sendCommand(command, timeout = null) {
        if (!this.isConnected) {
            throw new Error('Laixi 연결되지 않음');
        }
        
        const requestId = ++this._requestIdCounter;
        const commandWithId = { ...command, _requestId: requestId };
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            // 타임아웃 설정
            const timer = setTimeout(() => {
                if (this._pendingRequests.has(requestId)) {
                    this._pendingRequests.delete(requestId);
                    const err = new Error(`명령 타임아웃: ${command.action}`);
                    this._logError(err.message);
                    reject(err);
                }
            }, timeout || this.timeout);
            
            // 요청 등록
            this._pendingRequests.set(requestId, {
                resolve,
                reject,
                timer,
                startTime,
                command
            });
            
            // [OUT] 로그
            this._logOut(command);
            
            // 전송
            try {
                this._ws.send(JSON.stringify(commandWithId));
                this._stats.messagesSent++;
            } catch (err) {
                clearTimeout(timer);
                this._pendingRequests.delete(requestId);
                this._logError('전송 실패', err);
                reject(err);
            }
        });
    }
    
    // ==================== API 메서드 ====================
    
    /**
     * 연결된 디바이스 목록
     */
    async listDevices() {
        const response = await this.sendCommand({ action: LAIXI_COMMANDS.LIST });
        return response?.devices || response?.result || [];
    }
    
    /**
     * Toast 메시지 표시
     */
    async toast(deviceIds, content) {
        return this.sendCommand({
            action: LAIXI_COMMANDS.TOAST,
            comm: {
                deviceIds: deviceIds || 'all',
                content
            }
        });
    }
    
    /**
     * 터치 (탭)
     * @param {string} deviceIds - 대상 디바이스
     * @param {number} x - X 좌표 (0.0 ~ 1.0)
     * @param {number} y - Y 좌표 (0.0 ~ 1.0)
     */
    async tap(deviceIds, x, y) {
        // Press
        await this.sendCommand({
            action: LAIXI_COMMANDS.POINTER_EVENT,
            comm: {
                deviceIds: deviceIds || 'all',
                mask: '0',
                x: String(x),
                y: String(y),
                endx: '0',
                endy: '0',
                delta: '0'
            }
        });
        
        // 짧은 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Release
        return this.sendCommand({
            action: LAIXI_COMMANDS.POINTER_EVENT,
            comm: {
                deviceIds: deviceIds || 'all',
                mask: '2',
                x: String(x),
                y: String(y),
                endx: '0',
                endy: '0',
                delta: '0'
            }
        });
    }
    
    /**
     * 스와이프
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} direction - up, down, left, right
     */
    async swipe(deviceIds, direction) {
        const maskMap = {
            'up': '6',
            'down': '7',
            'left': '8',
            'right': '9'
        };
        
        if (!maskMap[direction]) {
            throw new Error(`Invalid direction: ${direction}`);
        }
        
        return this.sendCommand({
            action: LAIXI_COMMANDS.POINTER_EVENT,
            comm: {
                deviceIds: deviceIds || 'all',
                mask: maskMap[direction],
                x: '0.5',
                y: '0.5',
                endx: '0',
                endy: '0',
                delta: '2'
            }
        });
    }
    
    /**
     * 홈 버튼
     */
    async pressHome(deviceIds) {
        return this.sendCommand({
            action: LAIXI_COMMANDS.BASIS_OPERATE,
            comm: {
                deviceIds: deviceIds || 'all',
                type: '4'
            }
        });
    }
    
    /**
     * 뒤로가기
     */
    async pressBack(deviceIds) {
        return this.sendCommand({
            action: LAIXI_COMMANDS.BASIS_OPERATE,
            comm: {
                deviceIds: deviceIds || 'all',
                type: '3'
            }
        });
    }
    
    /**
     * ADB 명령 실행
     */
    async executeAdb(deviceIds, command) {
        return this.sendCommand({
            action: LAIXI_COMMANDS.ADB,
            comm: {
                deviceIds: deviceIds || 'all',
                command
            }
        });
    }
    
    /**
     * 클립보드에 텍스트 쓰기 (한글 입력용)
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} text - 클립보드에 저장할 텍스트
     */
    async setClipboard(deviceIds, text) {
        return this.sendCommand({
            action: LAIXI_COMMANDS.WRITE_CLIPBOARD,
            comm: {
                deviceIds: deviceIds || 'all',
                content: text
            }
        });
    }
    
    /**
     * 붙여넣기 (Ctrl+V)
     * @param {string} deviceIds - 대상 디바이스
     */
    async paste(deviceIds) {
        // ADB를 통한 붙여넣기 시뮬레이션
        return this.executeAdb(deviceIds, 'input keyevent 279');
    }
    
    /**
     * 앱 열기
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} appName - 앱 이름 (youtube, spotify, tiktok 등)
     */
    async openApp(deviceIds, appName) {
        const packageMap = {
            youtube: 'com.google.android.youtube',
            spotify: 'com.spotify.music',
            tiktok: 'com.zhiliaoapp.musically',
        };
        
        const packageName = packageMap[appName.toLowerCase()] || appName;
        
        return this.executeAdb(deviceIds, `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
    }
    
    /**
     * 키 이벤트 전송
     * @param {string} deviceIds - 대상 디바이스
     * @param {number} keyCode - Android KeyCode (예: 66=Enter, 4=Back, 3=Home)
     */
    async sendKey(deviceIds, keyCode) {
        return this.executeAdb(deviceIds, `input keyevent ${keyCode}`);
    }
    
    /**
     * 텍스트 입력 (영어만 지원, 한글은 setClipboard+paste 사용)
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} text - 입력할 텍스트
     */
    async inputText(deviceIds, text) {
        // 공백과 특수문자 이스케이프
        const escapedText = text.replace(/([\\'"$`!])/g, '\\$1').replace(/ /g, '%s');
        return this.executeAdb(deviceIds, `input text "${escapedText}"`);
    }
    
    /**
     * URL 열기
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} url - 열 URL 또는 딥링크
     */
    async openUrl(deviceIds, url) {
        return this.executeAdb(deviceIds, `am start -a android.intent.action.VIEW -d "${url}"`);
    }
    
    /**
     * 커스텀 스와이프 (좌표 지정)
     * @param {string} deviceIds - 대상 디바이스
     * @param {number} x1 - 시작 X
     * @param {number} y1 - 시작 Y
     * @param {number} x2 - 종료 X
     * @param {number} y2 - 종료 Y
     * @param {number} duration - 지속 시간(ms)
     */
    async swipeCoords(deviceIds, x1, y1, x2, y2, duration = 500) {
        return this.executeAdb(deviceIds, `input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    }
    
    /**
     * 더블 탭 (영상 앞으로/뒤로 가기용)
     * @param {string} deviceIds - 대상 디바이스
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    async doubleTap(deviceIds, x, y) {
        await this.tap(deviceIds, x, y);
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.tap(deviceIds, x, y);
    }
}

module.exports = LaixiAdapter;
module.exports.LAIXI_COMMANDS = LAIXI_COMMANDS;
module.exports.CONNECTION_STATE = CONNECTION_STATE;

