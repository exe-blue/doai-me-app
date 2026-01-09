/**
 * WebSocket Multiplexer
 * 
 * Aria 명세서 (2025-01-15) - Dynamic Device Architecture v3.0
 * 
 * 단일 WebSocket 연결로 모든 디바이스 처리
 * - Binary: 비디오 프레임 (Header + Payload)
 * - JSON: 컨트롤 명령, 상태 업데이트
 * 
 * Binary Frame Format:
 * [deviceIdHash:4][length:4][payload]
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { spawn } = require('child_process');

/**
 * 메시지 타입
 */
const MESSAGE_TYPES = {
    // Client → Server
    STREAM_SUBSCRIBE: 'stream:subscribe',
    STREAM_UNSUBSCRIBE: 'stream:unsubscribe',
    CONTROL_TOUCH: 'control:touch',
    CONTROL_KEY: 'control:key',
    LOGS_SUBSCRIBE: 'logs:subscribe',
    LOGS_UNSUBSCRIBE: 'logs:unsubscribe',

    // Server → Client
    DEVICE_STATUS: 'device:status',
    DEVICES_UPDATED: 'devices:updated',
    LOG_ENTRY: 'log:entry',
    ERROR: 'error'
};

/**
 * 품질 프리셋
 */
const QUALITY_PRESETS = {
    LOW: { maxSize: 480, maxFps: 10, bitRate: 500000 },
    MEDIUM: { maxSize: 720, maxFps: 15, bitRate: 2000000 },
    HIGH: { maxSize: 1080, maxFps: 30, bitRate: 4000000 }
};

class WebSocketMultiplexer {
    /**
     * @param {Object} logger - Logger
     * @param {Object} adbClient - ADB 클라이언트
     * @param {Object} discoveryManager - Discovery 매니저
     * @param {Object} commander - ADB Commander
     */
    constructor(logger, adbClient, discoveryManager, commander) {
        this.logger = logger;
        this.adbClient = adbClient;
        this.discoveryManager = discoveryManager;
        this.commander = commander;
        
        this.wss = null;
        this.clients = new Set(); // WebSocket 클라이언트
        
        // 디바이스별 스트림 상태
        this.streams = new Map(); // deviceId -> StreamSession
        
        // 디바이스 ID → Hash 매핑 (빠른 lookup용)
        this.deviceHashMap = new Map();
    }

    /**
     * 초기화
     */
    initialize(server) {
        // 모든 WebSocket 서버를 noServer 모드로 설정
        // 이렇게 해야 여러 경로를 동시에 처리할 수 있음
        
        // 메인 Multiplexer WebSocket (/ws)
        // 모든 WebSocket에서 압축 비활성화 (바이너리 스트리밍에 필수)
        this.wss = new WebSocket.Server({ 
            noServer: true,
            perMessageDeflate: false
        });

        this.wss.on('connection', (ws, req) => {
            this._handleConnection(ws, req);
        });
        
        // 개별 디바이스 스트림 WebSocket (/ws/stream/:deviceId)
        this.streamWss = new WebSocket.Server({ 
            noServer: true,
            perMessageDeflate: false,
            clientNoContextTakeover: true,  // 추가 압축 방지
            serverNoContextTakeover: true
        });
        
        this.streamWss.on('connection', (ws, req) => {
            this._handleStreamConnection(ws, req);
        });
        
        // HTTP upgrade 이벤트 중앙 처리
        server.on('upgrade', (request, socket, head) => {
            const pathname = request.url.split('?')[0];  // 쿼리스트링 제거
            
            // /ws/stream/{deviceId} 경로 매칭 (먼저 검사 - 더 구체적인 경로)
            if (pathname.startsWith('/ws/stream/')) {
                this.streamWss.handleUpgrade(request, socket, head, (ws) => {
                    this.streamWss.emit('connection', ws, request);
                });
                return;
            }
            
            // /ws 경로 매칭
            if (pathname === '/ws') {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
                return;
            }
            
            // /stream 경로는 Legacy StreamServer가 처리 (path 옵션 사용)
            // 여기서 처리하지 않으면 다른 곳에서 처리하거나 연결 거부됨
        });

        // Discovery 이벤트 리스닝
        this.discoveryManager.on('device:added', (device) => {
            this._broadcastDeviceUpdate('added', device);
        });

        this.discoveryManager.on('device:removed', (device) => {
            this._broadcastDeviceUpdate('removed', device);
            this._stopDeviceStream(device.serial);
        });

        this.discoveryManager.on('device:changed', (device) => {
            this._broadcastDeviceUpdate('changed', device);
        });

        this.logger.info('[WSMultiplexer] 초기화 완료', { path: '/ws' });
    }

    /**
     * WebSocket 연결 처리
     */
    _handleConnection(ws, req) {
        const clientId = this._generateClientId();
        ws.clientId = clientId;
        ws.subscriptions = new Set(); // 구독 중인 디바이스
        
        this.clients.add(ws);
        this.logger.info('[WSMultiplexer] 클라이언트 연결', { clientId });

        ws.on('message', (data) => {
            this._handleMessage(ws, data);
        });

        ws.on('close', () => {
            this._handleDisconnect(ws);
        });

        ws.on('error', (err) => {
            this.logger.warn('[WSMultiplexer] 클라이언트 오류', { 
                clientId, 
                error: err.message 
            });
        });

        // 초기 디바이스 목록 전송
        this._sendDeviceList(ws);
    }
    
    /**
     * 개별 디바이스 스트림 WebSocket 연결 처리
     * 경로: /ws/stream/:deviceId
     */
    _handleStreamConnection(ws, req) {
        // URL에서 deviceId 추출 (쿼리스트링 처리)
        const urlWithoutQuery = req.url.split('?')[0];
        const match = urlWithoutQuery.match(/^\/ws\/stream\/(.+)$/);
        if (!match) {
            this.logger.warn('[WSMultiplexer] 잘못된 스트림 경로', { url: req.url });
            ws.close(4000, 'Invalid path');
            return;
        }
        
        const deviceId = decodeURIComponent(match[1]);
        const clientId = this._generateClientId();
        
        ws.clientId = clientId;
        ws.deviceId = deviceId;
        ws.isDedicatedStream = true;
        
        this.clients.add(ws);
        this.logger.info('[WSMultiplexer] 스트림 전용 연결', { clientId, deviceId });
        
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                // stream:subscribe는 자동 처리
                if (message.type === MESSAGE_TYPES.STREAM_SUBSCRIBE) {
                    const quality = message.quality || {};
                    const qualityPreset = QUALITY_PRESETS[quality.resolution] || QUALITY_PRESETS.MEDIUM;
                    
                    await this._subscribeToDeviceStream(ws, deviceId, qualityPreset);
                    return;
                }
                
                // stream:quality 업데이트
                if (message.type === 'stream:quality') {
                    const quality = message.quality || {};
                    const qualityPreset = QUALITY_PRESETS[quality.resolution] || QUALITY_PRESETS.MEDIUM;
                    
                    // 기존 스트림 재시작
                    await this._stopClientStream(ws, deviceId);
                    await this._subscribeToDeviceStream(ws, deviceId, qualityPreset);
                    return;
                }
                
                // 터치/키 컨트롤
                if (message.type === MESSAGE_TYPES.CONTROL_TOUCH) {
                    await this._handleTouchControl(ws, { ...message, deviceId });
                    return;
                }
                
                if (message.type === MESSAGE_TYPES.CONTROL_KEY) {
                    await this._handleKeyControl(ws, { ...message, deviceId });
                    return;
                }
                
            } catch (e) {
                this.logger.warn('[WSMultiplexer] 스트림 메시지 오류', { error: e.message });
            }
        });
        
        ws.on('close', () => {
            this._handleStreamDisconnect(ws);
        });
        
        ws.on('error', (err) => {
            this.logger.warn('[WSMultiplexer] 스트림 오류', { 
                clientId, 
                deviceId,
                error: err.message 
            });
        });
        
        // 디바이스 존재 여부 확인
        const device = this.discoveryManager.getDevice(deviceId);
        if (!device) {
            ws.send(JSON.stringify({
                type: 'stream:error',
                message: `디바이스를 찾을 수 없음: ${deviceId}`
            }));
        } else if (device.status !== 'ONLINE') {
            ws.send(JSON.stringify({
                type: 'stream:error', 
                message: `디바이스가 오프라인: ${deviceId}`
            }));
        }
    }
    
    /**
     * 스트림 전용 연결 해제 처리
     */
    _handleStreamDisconnect(ws) {
        const { clientId, deviceId } = ws;
        
        this.logger.info('[WSMultiplexer] 스트림 연결 해제', { clientId, deviceId });
        
        // 클라이언트가 구독 중인 스트림 해제
        if (deviceId) {
            this._stopClientStream(ws, deviceId);
        }
        
        this.clients.delete(ws);
    }
    
    /**
     * 특정 클라이언트의 디바이스 스트림 구독 해제
     */
    _stopClientStream(ws, deviceId) {
        const stream = this.streams.get(deviceId);
        if (!stream) return;
        
        stream.subscribers.delete(ws);
        
        // 구독자가 없으면 스트림 종료
        if (stream.subscribers.size === 0) {
            this._stopDeviceStream(deviceId);
        }
    }
    
    /**
     * 디바이스 스트림 구독 (내부용)
     */
    async _subscribeToDeviceStream(ws, deviceId, qualityPreset) {
        // 디바이스 확인
        const device = this.discoveryManager.getDevice(deviceId);
        if (!device || device.status !== 'ONLINE') {
            ws.send(JSON.stringify({
                type: 'stream:error',
                message: `디바이스 사용 불가: ${deviceId}`
            }));
            return;
        }
        
        // 기존 스트림이 있으면 구독만 추가
        let stream = this.streams.get(deviceId);
        if (stream) {
            stream.subscribers.add(ws);
            this.logger.debug('[WSMultiplexer] 기존 스트림 구독', { deviceId, subscribers: stream.subscribers.size });
            return;
        }
        
        // 새 스트림 시작
        this.logger.info('[WSMultiplexer] 스트림 시작', { deviceId, quality: qualityPreset });
        
        stream = await this._startDeviceStream(deviceId, qualityPreset);
        if (stream) {
            stream.subscribers = new Set([ws]);
            this.streams.set(deviceId, stream);
        } else {
            ws.send(JSON.stringify({
                type: 'stream:error',
                message: `스트림 시작 실패: ${deviceId}`
            }));
        }
    }

    /**
     * 메시지 처리
     */
    async _handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            const { type } = message;

            switch (type) {
                case MESSAGE_TYPES.STREAM_SUBSCRIBE:
                    await this._handleStreamSubscribe(ws, message);
                    break;

                case MESSAGE_TYPES.STREAM_UNSUBSCRIBE:
                    await this._handleStreamUnsubscribe(ws, message);
                    break;

                case MESSAGE_TYPES.CONTROL_TOUCH:
                    await this._handleTouchControl(ws, message);
                    break;

                case MESSAGE_TYPES.CONTROL_KEY:
                    await this._handleKeyControl(ws, message);
                    break;

                case MESSAGE_TYPES.LOGS_SUBSCRIBE:
                    this._handleLogsSubscribe(ws, message);
                    break;

                case MESSAGE_TYPES.LOGS_UNSUBSCRIBE:
                    this._handleLogsUnsubscribe(ws, message);
                    break;

                default:
                    this._sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown type: ${type}`);
            }

        } catch (e) {
            this.logger.warn('[WSMultiplexer] 메시지 파싱 오류', { error: e.message });
            this._sendError(ws, 'PARSE_ERROR', e.message);
        }
    }

    /**
     * 스트림 구독 처리
     */
    async _handleStreamSubscribe(ws, message) {
        const { devices, quality } = message;
        const qualityPreset = QUALITY_PRESETS[quality?.resolution] || QUALITY_PRESETS.MEDIUM;

        for (const deviceId of devices) {
            // 디바이스 확인
            const device = this.discoveryManager.getDevice(deviceId);
            if (!device || device.status !== 'ONLINE') {
                this._sendError(ws, 'DEVICE_NOT_FOUND', `Device ${deviceId} not available`);
                continue;
            }

            // 구독 추가
            ws.subscriptions.add(deviceId);

            // 스트림이 없으면 시작
            if (!this.streams.has(deviceId)) {
                await this._startDeviceStream(deviceId, qualityPreset);
            }
        }

        this.logger.debug('[WSMultiplexer] 스트림 구독', { 
            clientId: ws.clientId, 
            devices,
            quality: quality?.resolution 
        });
    }

    /**
     * 스트림 구독 해제
     */
    async _handleStreamUnsubscribe(ws, message) {
        const { devices } = message;

        for (const deviceId of devices) {
            ws.subscriptions.delete(deviceId);
        }

        // 아무도 구독하지 않는 스트림 정리
        this._cleanupUnusedStreams();

        this.logger.debug('[WSMultiplexer] 스트림 구독 해제', { 
            clientId: ws.clientId, 
            devices 
        });
    }

    /**
     * 터치 제어 처리
     */
    async _handleTouchControl(ws, message) {
        const { deviceId, action, x, y, start, end, duration } = message;

        const device = this.discoveryManager.getDevice(deviceId);
        if (!device || device.status !== 'ONLINE') {
            this._sendError(ws, 'DEVICE_NOT_FOUND', `Device ${deviceId} not available`);
            return;
        }

        // 화면 해상도
        const width = device.displaySize?.width || 1080;
        const height = device.displaySize?.height || 2340;

        let adbCommand;

        switch (action) {
            case 'tap':
                const tapX = Math.round(x * width);
                const tapY = Math.round(y * height);
                adbCommand = `input tap ${tapX} ${tapY}`;
                break;

            case 'swipe':
                const sx = Math.round(start.x * width);
                const sy = Math.round(start.y * height);
                const ex = Math.round(end.x * width);
                const ey = Math.round(end.y * height);
                adbCommand = `input swipe ${sx} ${sy} ${ex} ${ey} ${duration || 300}`;
                break;

            case 'longPress':
                const lpX = Math.round(x * width);
                const lpY = Math.round(y * height);
                adbCommand = `input swipe ${lpX} ${lpY} ${lpX} ${lpY} ${duration || 1000}`;
                break;

            default:
                this._sendError(ws, 'INVALID_ACTION', `Unknown touch action: ${action}`);
                return;
        }

        try {
            await this.commander.shell(device.serial, adbCommand);
        } catch (e) {
            this._sendError(ws, 'COMMAND_FAILED', e.message);
        }
    }

    /**
     * 키 제어 처리
     */
    async _handleKeyControl(ws, message) {
        const { deviceId, keycode, text } = message;

        const device = this.discoveryManager.getDevice(deviceId);
        if (!device || device.status !== 'ONLINE') {
            this._sendError(ws, 'DEVICE_NOT_FOUND', `Device ${deviceId} not available`);
            return;
        }

        let adbCommand;

        if (keycode) {
            adbCommand = `input keyevent ${keycode}`;
        } else if (text) {
            const escaped = text.replace(/ /g, '%s').replace(/'/g, "\\'");
            adbCommand = `input text '${escaped}'`;
        } else {
            this._sendError(ws, 'INVALID_PARAMS', 'keycode or text required');
            return;
        }

        try {
            await this.commander.shell(device.serial, adbCommand);
        } catch (e) {
            this._sendError(ws, 'COMMAND_FAILED', e.message);
        }
    }

    /**
     * 디바이스 스트림 시작
     * @returns {Object|null} 생성된 세션 객체 또는 null
     */
    async _startDeviceStream(deviceId, quality) {
        if (this.streams.has(deviceId)) {
            return this.streams.get(deviceId);
        }

        const device = this.discoveryManager.getDevice(deviceId);
        if (!device) {
            return null;
        }

        const session = {
            deviceId,
            quality,
            process: null,
            clients: new Set(),
            startedAt: Date.now()
        };

        // Device ID Hash 생성 (4바이트)
        const hash = this._getDeviceHash(deviceId);

        try {
            // screenrecord 사용 (H.264 출력)
            const args = [
                '-s', device.serial,
                'exec-out',
                'screenrecord',
                '--output-format=h264',
                '--bit-rate', quality.bitRate.toString(),
                '--size', `${quality.maxSize}x${Math.round(quality.maxSize * 16/9)}`,
                '-'
            ];

            const proc = spawn('adb', args);
            session.process = proc;

            proc.stdout.on('data', (chunk) => {
                this._broadcastVideoFrame(deviceId, hash, chunk);
            });

            proc.stderr.on('data', (data) => {
                this.logger.debug('[WSMultiplexer] 스트림 stderr', { 
                    deviceId, 
                    data: data.toString() 
                });
            });

            proc.on('close', (code) => {
                this.logger.debug('[WSMultiplexer] 스트림 종료', { deviceId, code });
                this.streams.delete(deviceId);
            });

            proc.on('error', (err) => {
                this.logger.warn('[WSMultiplexer] 스트림 오류', { 
                    deviceId, 
                    error: err.message 
                });
                this.streams.delete(deviceId);
            });

            this.streams.set(deviceId, session);
            this.logger.info('[WSMultiplexer] 스트림 시작', { deviceId, quality });
            
            return session;

        } catch (e) {
            this.logger.error('[WSMultiplexer] 스트림 시작 실패', { 
                deviceId, 
                error: e.message 
            });
            return null;
        }
    }

    /**
     * 디바이스 스트림 중지
     */
    _stopDeviceStream(deviceId) {
        const session = this.streams.get(deviceId);
        if (!session) return;

        if (session.process) {
            session.process.kill();
        }

        this.streams.delete(deviceId);
        this.logger.debug('[WSMultiplexer] 스트림 중지', { deviceId });
    }

    /**
     * 사용하지 않는 스트림 정리
     */
    _cleanupUnusedStreams() {
        for (const [deviceId, session] of this.streams) {
            // 아무도 구독하지 않으면 종료
            let hasSubscribers = false;
            
            for (const client of this.clients) {
                if (client.subscriptions.has(deviceId)) {
                    hasSubscribers = true;
                    break;
                }
            }

            if (!hasSubscribers) {
                this._stopDeviceStream(deviceId);
            }
        }
    }

    /**
     * 비디오 프레임 브로드캐스트 (Binary)
     */
    _broadcastVideoFrame(deviceId, hash, payload) {
        // Binary frame: [hash:4][length:4][payload]
        const header = Buffer.alloc(8);
        header.writeUInt32LE(hash, 0);
        header.writeUInt32LE(payload.length, 4);
        
        const frame = Buffer.concat([header, payload]);

        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && 
                client.subscriptions.has(deviceId)) {
                client.send(frame);
            }
        }
    }

    /**
     * 디바이스 업데이트 브로드캐스트
     */
    _broadcastDeviceUpdate(action, device) {
        const message = {
            type: MESSAGE_TYPES.DEVICES_UPDATED,
            action,
            device: {
                serial: device.serial,
                status: device.status,
                connectionType: device.connectionType
            },
            count: this.discoveryManager.getDeviceCount()
        };

        this._broadcastJson(message);
    }

    /**
     * JSON 브로드캐스트
     */
    _broadcastJson(message) {
        const data = JSON.stringify(message);
        
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    /**
     * 디바이스 목록 전송
     */
    _sendDeviceList(ws) {
        const devices = this.discoveryManager.getDevices();
        const count = this.discoveryManager.getDeviceCount();

        ws.send(JSON.stringify({
            type: MESSAGE_TYPES.DEVICES_UPDATED,
            action: 'initial',
            devices: devices.map(d => ({
                serial: d.serial,
                status: d.status,
                connectionType: d.connectionType,
                model: d.model,
                aiCitizenId: d.aiCitizenId,
                gatewayClientConnected: d.gatewayClientConnected
            })),
            count
        }));
    }

    /**
     * 에러 전송
     */
    _sendError(ws, code, message) {
        ws.send(JSON.stringify({
            type: MESSAGE_TYPES.ERROR,
            code,
            message
        }));
    }

    /**
     * 연결 해제 처리
     */
    _handleDisconnect(ws) {
        this.clients.delete(ws);
        this.logger.info('[WSMultiplexer] 클라이언트 연결 해제', { clientId: ws.clientId });
        
        // 미사용 스트림 정리
        this._cleanupUnusedStreams();
    }

    /**
     * Device ID Hash 생성 (4바이트)
     */
    _getDeviceHash(deviceId) {
        if (this.deviceHashMap.has(deviceId)) {
            return this.deviceHashMap.get(deviceId);
        }

        const hash = crypto.createHash('md5').update(deviceId).digest();
        const value = hash.readUInt32LE(0);
        
        this.deviceHashMap.set(deviceId, value);
        return value;
    }

    /**
     * 클라이언트 ID 생성
     */
    _generateClientId() {
        return `client_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    }

    /**
     * 로그 구독 처리
     */
    _handleLogsSubscribe(ws, message) {
        // TODO: 로그 구독 구현
        ws.logSubscriptions = ws.logSubscriptions || new Set();
        ws.logSubscriptions.add(message.deviceId);
    }

    /**
     * 로그 구독 해제
     */
    _handleLogsUnsubscribe(ws, message) {
        if (ws.logSubscriptions) {
            ws.logSubscriptions.delete(message.deviceId);
        }
    }

    /**
     * 종료
     */
    shutdown() {
        // 모든 스트림 종료
        for (const [deviceId] of this.streams) {
            this._stopDeviceStream(deviceId);
        }

        // WebSocket 서버 종료
        if (this.wss) {
            try {
                this.wss.close((err) => {
                    if (err) {
                        this.logger.error('[WSMultiplexer] wss 종료 오류:', err);
                    }
                });
            } catch (err) {
                this.logger.error('[WSMultiplexer] wss 종료 중 예외:', err);
            }
        }

        // 스트림 WebSocket 서버 종료
        if (this.streamWss) {
            try {
                // 연결된 클라이언트 종료
                this.streamWss.clients.forEach((client) => {
                    try {
                        client.terminate();
                    } catch (e) {
                        // 무시
                    }
                });
                this.streamWss.close((err) => {
                    if (err) {
                        this.logger.error('[WSMultiplexer] streamWss 종료 오류:', err);
                    }
                });
            } catch (err) {
                this.logger.error('[WSMultiplexer] streamWss 종료 중 예외:', err);
            }
            this.streamWss = null;
        }

        this.logger.info('[WSMultiplexer] 종료');
    }
}

module.exports = WebSocketMultiplexer;
module.exports.MESSAGE_TYPES = MESSAGE_TYPES;
module.exports.QUALITY_PRESETS = QUALITY_PRESETS;

