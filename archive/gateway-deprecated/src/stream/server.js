/**
 * Stream Server
 * Scrcpy 기반 디바이스 화면 스트리밍
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoints:
 * - GET /stream/{device_id}/view - Iframe-embeddable HTML
 * - WS  /stream/{device_id}/ws   - H.264 WebSocket stream
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Quality Presets (Aria 명세)
 */
const QUALITY_PRESETS = {
    low: { maxSize: 800, maxFps: 10, bitRate: 1000000 },
    medium: { maxSize: 1080, maxFps: 15, bitRate: 2000000 },
    high: { maxSize: 1440, maxFps: 30, bitRate: 4000000 }
};

class StreamServer {
    constructor(logger, adbClient, deviceTracker) {
        this.logger = logger;
        this.adbClient = adbClient;
        this.deviceTracker = deviceTracker;
        this.wss = null;
        this.streams = new Map(); // device_id -> StreamSession
    }

    /**
     * WebSocket 서버 초기화
     */
    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/stream'
        });

        this.wss.on('connection', (ws, req) => {
            this._handleConnection(ws, req);
        });

        this.logger.info('[Stream] WebSocket 서버 초기화');
    }

    /**
     * WebSocket 연결 처리
     */
    _handleConnection(ws, req) {
        // URL에서 device_id 추출: /stream/{device_id}/ws
        const urlParts = req.url.split('/');
        const deviceId = urlParts[2];

        if (!deviceId) {
            ws.close(4000, 'device_id required');
            return;
        }

        // 기기 확인
        const device = this.deviceTracker.getDevice(deviceId);
        if (!device) {
            ws.close(4004, 'Device not found');
            return;
        }

        this.logger.info('[Stream] 클라이언트 연결', { deviceId });

        // Query params 파싱
        const url = new URL(req.url, `http://${req.headers.host}`);
        const quality = url.searchParams.get('quality') || 'medium';
        const touchable = url.searchParams.get('touchable') === 'true';

        // 스트림 세션 생성
        const session = this._createStreamSession(deviceId, ws, quality);
        
        // 터치 이벤트 핸들링
        if (touchable) {
            ws.on('message', (data) => {
                this._handleTouchEvent(deviceId, data);
            });
        }

        ws.on('close', () => {
            this.logger.info('[Stream] 클라이언트 연결 해제', { deviceId });
            this._destroyStreamSession(deviceId);
        });

        ws.on('error', (err) => {
            this.logger.error('[Stream] WebSocket 오류', { 
                deviceId, 
                error: err.message 
            });
        });
    }

    /**
     * 스트림 세션 생성
     */
    _createStreamSession(deviceId, ws, quality) {
        // 기존 세션 정리
        if (this.streams.has(deviceId)) {
            this._destroyStreamSession(deviceId);
        }

        const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
        const device = this.deviceTracker.getDevice(deviceId);

        // Scrcpy 프로세스 시작
        const scrcpyArgs = [
            '-s', device.id,
            '--no-audio',
            '--no-control', // 제어는 별도 API로
            '--max-size', preset.maxSize.toString(),
            '--max-fps', preset.maxFps.toString(),
            '--bit-rate', preset.bitRate.toString(),
            '--codec=h264',
            '--encoder=OMX.qcom.video.encoder.avc', // Qualcomm 인코더
            '--raw-key-events'
        ];

        // Scrcpy 실행 (scrcpy가 설치되어 있어야 함)
        let scrcpyProcess = null;
        
        try {
            // scrcpy-server 직접 사용 (adb exec-out)
            scrcpyProcess = this._startScrcpyServer(device.id, preset);
        } catch (e) {
            this.logger.warn('[Stream] Scrcpy 시작 실패, 대체 모드 사용', { 
                error: e.message 
            });
            // 대체: 스크린샷 기반 스트리밍 (폴백)
            scrcpyProcess = this._startFallbackStream(device.id, preset, ws);
        }

        const session = {
            deviceId,
            ws,
            quality,
            preset,
            process: scrcpyProcess,
            startedAt: Date.now()
        };

        this.streams.set(deviceId, session);

        // 상태 메시지 전송
        ws.send(JSON.stringify({
            type: 'status',
            status: 'connected',
            quality,
            fps: preset.maxFps,
            bitrate: preset.bitRate
        }));

        return session;
    }

    /**
     * Scrcpy 서버 시작 (ADB를 통해)
     */
    _startScrcpyServer(serial, preset) {
        // scrcpy가 설치되어 있다고 가정
        // 실제로는 scrcpy-server.jar를 기기에 푸시하고 실행해야 함
        
        this.logger.debug('[Stream] Scrcpy 서버 시작', { serial, preset });
        
        // 간단한 구현: screenrecord 사용 (H.264 출력)
        const args = [
            '-s', serial,
            'exec-out',
            'screenrecord',
            '--output-format=h264',
            '--bit-rate', preset.bitRate.toString(),
            '--size', `${preset.maxSize}x${Math.round(preset.maxSize * 16/9)}`,
            '-'
        ];

        const process = spawn('adb', args);

        process.stdout.on('data', (chunk) => {
            const session = this.streams.get(serial);
            if (session && session.ws.readyState === WebSocket.OPEN) {
                session.ws.send(chunk);
            }
        });

        process.stderr.on('data', (data) => {
            this.logger.debug('[Stream] stderr', { data: data.toString() });
        });

        process.on('error', (err) => {
            this.logger.error('[Stream] 프로세스 오류', { error: err.message });
        });

        return process;
    }

    /**
     * 폴백 스트리밍 (스크린샷 기반)
     */
    _startFallbackStream(serial, preset, ws) {
        const fps = Math.min(preset.maxFps, 5); // 폴백은 최대 5fps
        const interval = Math.floor(1000 / fps);

        const timer = setInterval(async () => {
            try {
                // 스크린샷 캡처
                const screenshot = await this._captureScreenshot(serial);
                
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(screenshot);
                }
            } catch (e) {
                // 무시
            }
        }, interval);

        return {
            kill: () => clearInterval(timer)
        };
    }

    /**
     * 스크린샷 캡처
     */
    async _captureScreenshot(serial) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const process = spawn('adb', [
                '-s', serial,
                'exec-out',
                'screencap',
                '-p'
            ]);

            process.stdout.on('data', (chunk) => chunks.push(chunk));
            process.on('close', () => resolve(Buffer.concat(chunks)));
            process.on('error', reject);
        });
    }

    /**
     * 터치 이벤트 처리
     */
    async _handleTouchEvent(deviceId, data) {
        try {
            const event = JSON.parse(data.toString());
            const device = this.deviceTracker.getDevice(deviceId);
            
            if (!device || event.type !== 'touch') return;

            // 정규화 좌표 → 픽셀 좌표 변환
            // 기본 해상도 가정 (실제로는 기기에서 가져와야 함)
            const screenWidth = 1080;
            const screenHeight = 2340;
            
            const x = Math.round(event.x * screenWidth);
            const y = Math.round(event.y * screenHeight);

            // ADB 터치 명령
            let cmd;
            switch (event.action) {
                case 'tap':
                    cmd = `input tap ${x} ${y}`;
                    break;
                case 'down':
                case 'up':
                case 'move':
                    // 복잡한 제스처는 sendevent 사용 필요
                    cmd = `input tap ${x} ${y}`;
                    break;
            }

            if (cmd) {
                await this.adbClient.shell(device.id, cmd);
            }

        } catch (e) {
            this.logger.warn('[Stream] 터치 이벤트 처리 실패', { 
                error: e.message 
            });
        }
    }

    /**
     * 스트림 세션 종료
     */
    _destroyStreamSession(deviceId) {
        const session = this.streams.get(deviceId);
        if (!session) return;

        if (session.process) {
            session.process.kill();
        }

        this.streams.delete(deviceId);
        this.logger.debug('[Stream] 세션 종료', { deviceId });
    }

    /**
     * Stream View HTML 생성
     */
    generateViewHtml(deviceId, options = {}) {
        const quality = options.quality || 'medium';
        const showStatus = options.showStatus !== 'false';
        const touchable = options.touchable === 'true';

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>DoAi Stream - ${deviceId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a1a; }
    #canvas { width: 100%; height: 100%; object-fit: contain; }
    .status { 
      position: absolute; top: 8px; left: 8px;
      color: #fff; font: 12px monospace;
      background: rgba(0,0,0,0.6); padding: 4px 8px;
      border-radius: 4px;
      display: ${showStatus ? 'block' : 'none'};
    }
    .offline { 
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: #666; font: 16px sans-serif;
      flex-direction: column; gap: 16px;
    }
    .offline-icon { font-size: 48px; }
    .connecting { animation: pulse 1.5s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div id="container">
    <canvas id="canvas" data-touchable="${touchable}"></canvas>
    <div class="status" id="status">Connecting...</div>
  </div>
  <script src="/stream/scrcpy-client.js"></script>
  <script>
    const deviceId = '${deviceId}';
    const quality = '${quality}';
    const wsUrl = 'ws://' + location.host + '/stream/' + deviceId + '/ws?quality=' + quality;
    initScrcpyClient('canvas', wsUrl, 'status');
  </script>
</body>
</html>`;
    }

    /**
     * 전체 스트림 종료
     */
    shutdown() {
        for (const [deviceId] of this.streams) {
            this._destroyStreamSession(deviceId);
        }
        
        if (this.wss) {
            this.wss.close();
        }
    }
}

module.exports = StreamServer;
module.exports.QUALITY_PRESETS = QUALITY_PRESETS;



