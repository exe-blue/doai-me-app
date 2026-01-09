/**
 * H.264 Screen Stream Server
 * 
 * ADB screenrecord를 사용한 실시간 화면 스트리밍
 * Laixi API에 화면 스트리밍이 없으므로 ADB 직접 사용
 * 
 * 목표 지연시간: < 500ms
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// 품질 프리셋
const QUALITY_PRESETS = {
    low: { 
        bitRate: 500000,  // 500Kbps
        maxSize: 480,
        targetFps: 10 
    },
    medium: { 
        bitRate: 1500000,  // 1.5Mbps
        maxSize: 720,
        targetFps: 15 
    },
    high: { 
        bitRate: 4000000,  // 4Mbps
        maxSize: 1080,
        targetFps: 30 
    }
};

// 상수 정의
const SCREENRECORD_TIME_LIMIT = 180;  // 3분 (Android 제한)
const RECONNECT_DELAY_MS = 100;       // screenrecord 재시작 간격

class H264StreamSession extends EventEmitter {
    /**
     * @param {string} serial - ADB 기기 시리얼
     * @param {string} quality - 품질 프리셋 (low, medium, high)
     * @param {Object} logger - 로거
     */
    constructor(serial, quality = 'medium', logger = console) {
        super();
        
        this.serial = serial;
        this.quality = quality;
        this.preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
        this.logger = logger;
        
        this._process = null;
        this._isRunning = false;
        this._restartTimer = null;
        
        // 통계
        this._stats = {
            bytesStreamed: 0,
            chunks: 0,
            startTime: null,
            errors: 0
        };
    }
    
    /**
     * 스트리밍 시작
     */
    start() {
        if (this._isRunning) {
            this.logger.warn(`[H264] 이미 실행 중: ${this.serial}`);
            return;
        }
        
        this._isRunning = true;
        this._stats.startTime = Date.now();
        
        this._startScreenrecord();
    }
    
    /**
     * screenrecord 프로세스 시작
     */
    _startScreenrecord() {
        if (!this._isRunning) return;
        
        // screenrecord 명령 구성
        // --output-format=h264: H.264 raw 출력
        // --bit-rate: 비트레이트 설정
        // --size: 해상도 설정 (16:9 비율 가정)
        // --time-limit: Android는 최대 3분 제한
        // -: stdout으로 출력
        const args = [
            '-s', this.serial,
            'exec-out',
            'screenrecord',
            '--output-format=h264',
            '--bit-rate', this.preset.bitRate.toString(),
            '--size', `${this.preset.maxSize}x${Math.round(this.preset.maxSize * 16/9)}`,
            '--time-limit', SCREENRECORD_TIME_LIMIT.toString(),
            '-'
        ];
        
        this.logger.info(`[H264] screenrecord 시작: ${this.serial}`, {
            quality: this.quality,
            bitRate: this.preset.bitRate,
            size: this.preset.maxSize
        });
        
        try {
            this._process = spawn('adb', args);
            
            // H.264 데이터 수신
            this._process.stdout.on('data', (chunk) => {
                this._stats.bytesStreamed += chunk.length;
                this._stats.chunks++;
                
                // 바이너리 데이터 이벤트 발생
                this.emit('data', chunk);
            });
            
            // 에러 로그
            this._process.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) {
                    this.logger.debug(`[H264] stderr: ${msg}`);
                }
            });
            
            // 프로세스 종료 처리
            this._process.on('close', (code) => {
                this.logger.info(`[H264] screenrecord 종료: ${this.serial}, code=${code}`);
                
                // 시간 제한으로 종료된 경우 재시작
                if (this._isRunning && code === 0) {
                    this._scheduleRestart();
                }
            });
            
            this._process.on('error', (err) => {
                this._stats.errors++;
                this.logger.error(`[H264] 프로세스 오류: ${err.message}`);
                this.emit('error', err);
                
                // 오류 후 재시작 시도
                if (this._isRunning) {
                    this._scheduleRestart();
                }
            });
            
        } catch (err) {
            this._stats.errors++;
            this.logger.error(`[H264] 시작 실패: ${err.message}`);
            this.emit('error', err);
        }
    }
    
    /**
     * screenrecord 재시작 예약
     */
    _scheduleRestart() {
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
        }
        
        this._restartTimer = setTimeout(() => {
            if (this._isRunning) {
                this.logger.info(`[H264] screenrecord 재시작: ${this.serial}`);
                this._startScreenrecord();
            }
        }, RECONNECT_DELAY_MS);
    }
    
    /**
     * 스트리밍 중지
     */
    stop() {
        this._isRunning = false;
        
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        
        if (this._process) {
            this._process.kill();
            this._process = null;
        }
        
        this.logger.info(`[H264] 스트리밍 중지: ${this.serial}`, {
            duration: Date.now() - this._stats.startTime,
            bytesStreamed: this._stats.bytesStreamed,
            chunks: this._stats.chunks
        });
        
        this.emit('stop');
    }
    
    /**
     * 통계 조회
     */
    getStats() {
        return {
            ...this._stats,
            isRunning: this._isRunning,
            uptime: this._stats.startTime ? Date.now() - this._stats.startTime : 0
        };
    }
}


/**
 * H264 WebSocket Stream Server
 * 
 * WebSocket 클라이언트에게 H.264 스트림 전송
 * 
 * EventEmitter를 상속하여 이벤트 기반 통신 지원
 */
class H264StreamServer extends EventEmitter {
    /**
     * @param {Object} options
     * @param {Object} options.logger - 로거
     * @param {Object} options.deviceTracker - 기기 추적기
     */
    constructor(options = {}) {
        // EventEmitter 초기화 (반드시 super() 호출 필요)
        super();
        
        this.logger = options.logger || console;
        this.deviceTracker = options.deviceTracker;
        
        this._wss = null;
        this._sessions = new Map();  // serial -> { session, clients }
        this._basePath = '/ws/stream';
    }
    
    /**
     * WebSocket 서버 초기화
     * 
     * noServer 모드 사용: HTTP 서버의 upgrade 이벤트를 직접 처리
     * 이렇게 해야 /ws/stream/{deviceId} 같은 동적 경로를 지원할 수 있음
     * 
     * @param {http.Server} httpServer - HTTP 서버
     * @param {string} basePath - WebSocket 기본 경로 (기본: /ws/stream)
     */
    initialize(httpServer, basePath = '/ws/stream') {
        this._basePath = basePath;
        
        // noServer 모드로 WebSocket 서버 생성
        this._wss = new WebSocket.Server({
            noServer: true,
            perMessageDeflate: false  // 실시간 스트리밍에는 압축 비활성화
        });
        
        // HTTP upgrade 이벤트 직접 처리
        httpServer.on('upgrade', (request, socket, head) => {
            const pathname = request.url.split('?')[0];  // 쿼리스트링 제거
            
            // /ws/stream/{deviceId} 경로 매칭
            if (pathname.startsWith(this._basePath + '/')) {
                this._wss.handleUpgrade(request, socket, head, (ws) => {
                    this._wss.emit('connection', ws, request);
                });
            }
            // 다른 경로는 무시 (다른 WebSocket 서버가 처리)
        });
        
        this._wss.on('connection', (ws, req) => {
            this._handleConnection(ws, req);
        });
        
        this.logger.info(`[H264Server] WebSocket 서버 초기화: ${basePath}/{deviceId}`);
    }
    
    /**
     * WebSocket 연결 처리
     * 
     * URL 형식: /ws/stream/{deviceId}?quality=medium&touchable=true
     */
    _handleConnection(ws, req) {
        // URL 파싱
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const deviceId = pathParts[pathParts.length - 1];  // 마지막 경로 = deviceId
        
        if (!deviceId || deviceId === 'stream') {
            ws.close(4000, 'device_id required');
            return;
        }
        
        // 쿼리 파라미터
        const quality = url.searchParams.get('quality') || 'medium';
        const touchable = url.searchParams.get('touchable') === 'true';
        
        this.logger.info(`[H264Server] 클라이언트 연결`, {
            deviceId,
            quality,
            touchable,
            clientIp: req.socket.remoteAddress
        });
        
        // 기기 확인 (deviceTracker가 있는 경우)
        if (this.deviceTracker) {
            const device = this.deviceTracker.getDevice(deviceId);
            if (!device) {
                ws.close(4004, 'Device not found');
                return;
            }
        }
        
        // 세션 가져오기 또는 생성
        let sessionData = this._sessions.get(deviceId);
        
        if (!sessionData) {
            // 새 스트리밍 세션 생성
            const session = new H264StreamSession(deviceId, quality, this.logger);
            
            session.on('data', (chunk) => {
                // 연결된 모든 클라이언트에게 전송
                const data = this._sessions.get(deviceId);
                if (data) {
                    for (const client of data.clients) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(chunk);
                        }
                    }
                }
            });
            
            session.on('error', (err) => {
                // 에러를 모든 클라이언트에게 알림
                const data = this._sessions.get(deviceId);
                if (data) {
                    const errorMsg = JSON.stringify({
                        type: 'error',
                        message: err.message
                    });
                    for (const client of data.clients) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(errorMsg);
                        }
                    }
                }
            });
            
            session.start();
            
            sessionData = {
                session,
                clients: new Set(),
                quality
            };
            
            this._sessions.set(deviceId, sessionData);
        }
        
        // 클라이언트 추가
        sessionData.clients.add(ws);
        
        // 연결 상태 메시지 전송
        ws.send(JSON.stringify({
            type: 'connected',
            deviceId,
            quality: sessionData.quality,
            timestamp: Date.now()
        }));
        
        // 터치 이벤트 처리 (Laixi를 통해)
        if (touchable) {
            ws.on('message', (data) => {
                this._handleControlMessage(deviceId, data);
            });
        }
        
        // 연결 종료 처리
        ws.on('close', () => {
            this.logger.info(`[H264Server] 클라이언트 연결 해제`, { deviceId });
            
            const data = this._sessions.get(deviceId);
            if (data) {
                data.clients.delete(ws);
                
                // 모든 클라이언트가 연결 해제되면 세션 종료
                if (data.clients.size === 0) {
                    this.logger.info(`[H264Server] 세션 종료 (클라이언트 없음)`, { deviceId });
                    data.session.stop();
                    this._sessions.delete(deviceId);
                }
            }
        });
        
        ws.on('error', (err) => {
            this.logger.error(`[H264Server] WebSocket 오류`, {
                deviceId,
                error: err.message
            });
        });
    }
    
    /**
     * 제어 메시지 처리
     * 
     * 메시지 형식:
     * {
     *   type: 'control:touch' | 'control:key',
     *   payload: { ... }
     * }
     */
    _handleControlMessage(deviceId, data) {
        try {
            const message = JSON.parse(data.toString());
            
            this.logger.debug(`[H264Server] 제어 메시지`, { deviceId, message });
            
            // TODO: Laixi 어댑터를 통해 제어 명령 전송
            // 현재는 터치 제어를 구현하지 않음 (오리온 지시: 보는 것에만 집중)
            
            this.emit('control', { deviceId, message });
            
        } catch (err) {
            this.logger.warn(`[H264Server] 제어 메시지 파싱 실패`, { error: err.message });
        }
    }
    
    /**
     * 특정 기기의 세션 종료
     */
    stopSession(deviceId) {
        const data = this._sessions.get(deviceId);
        if (data) {
            // 모든 클라이언트 연결 해제
            for (const client of data.clients) {
                client.close(1000, 'Session stopped');
            }
            
            data.session.stop();
            this._sessions.delete(deviceId);
            
            this.logger.info(`[H264Server] 세션 강제 종료`, { deviceId });
        }
    }
    
    /**
     * 전체 종료
     */
    shutdown() {
        for (const [deviceId, data] of this._sessions) {
            data.session.stop();
            for (const client of data.clients) {
                client.close(1001, 'Server shutdown');
            }
        }
        
        this._sessions.clear();
        
        if (this._wss) {
            this._wss.close();
        }
        
        this.logger.info(`[H264Server] 서버 종료 완료`);
    }
    
    /**
     * 활성 세션 목록
     */
    getActiveSessions() {
        const sessions = [];
        for (const [deviceId, data] of this._sessions) {
            sessions.push({
                deviceId,
                quality: data.quality,
                clientCount: data.clients.size,
                stats: data.session.getStats()
            });
        }
        return sessions;
    }
}

module.exports = H264StreamServer;
module.exports.H264StreamSession = H264StreamSession;
module.exports.QUALITY_PRESETS = QUALITY_PRESETS;


