/**
 * DoAi-Gateway Main Entry Point
 * 
 * Aria 명세서 (2025-01-15) - Dynamic Device Architecture v3.0
 * 
 * 역할:
 * - Dynamic Device Discovery (USB/WiFi/LAN)
 * - WebSocket Multiplexing (단일 연결로 모든 디바이스)
 * - React 대시보드 내장
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');

const Logger = require('./utils/logger');
const Config = require('./utils/config');
const AdbClient = require('./adb/client');
const DeviceTracker = require('./adb/tracker');
const Commander = require('./adb/commander');
const Recovery = require('./adb/recovery');
const HeartbeatMonitor = require('./monitor/heartbeat');
const TaskQueue = require('./queue/task_queue');
const Dispatcher = require('./queue/dispatcher');

// Dynamic Discovery (v3.0)
const DiscoveryManager = require('./discovery/manager');
const { loadDiscoveryConfig } = require('./discovery/config');

// WebSocket Multiplexer (v3.0)
const WebSocketMultiplexer = require('./websocket/multiplexer');

// Dashboard WebSocket Handler (NodeContext 프로토콜)
const DashboardHandler = require('./websocket/dashboard-handler');

// API 라우터
const responseRouter = require('./api/routes/response');
const healthRouter = require('./api/routes/health');
const commandRouter = require('./api/routes/command');

// Dynamic Device API (v3.0)
const devicesRouter = require('./api/routes/devices');
const controlRouter = require('./api/routes/control');
const filesRouter = require('./api/routes/files');
const dispatchRouter = require('./api/routes/dispatch');
const streamRouter = require('./api/routes/stream');
const discoveryRouter = require('./api/routes/discovery');

// OpenAI Integration



const aiRouter = require('./api/routes/ai');

// Vultr WSS Integration (v2.1)
const { initVultrConnection, shutdownVultrConnection } = require('./vultr-integration');

// Laixi Adapter (Device Control via WebSocket)
const LaixiAdapter = require('./adapters/laixi/LaixiAdapter');

// Stream Server (Legacy, Iframe용)
const StreamServer = require('./stream/server');

// H.264 Stream Server (v2.0 - Real-time Screen Streaming)

// Chrome Automation Service (Puppeteer + CDP over ADB)
const { createChromeService } = require('./services/chrome');
const ChromeTaskHandler = require('./services/chrome/ChromeTaskHandler');
const chromeRouter = require('./api/routes/chrome');
const { initializeChromeRoutes } = require('./api/routes/chrome');

// YouTube API Router
const youtubeRouter = require('./api/routes/youtube');

// Kernel API Router (YouTube app automation)
const kernelRouter = require('./api/routes/kernel');
const { initKernelRouter } = require('./api/routes/kernel');

const H264StreamServer = require('./stream/h264-stream');

// ==================== Laixi Adapter (Device Control) ====================
let laixiAdapter = null; // start()에서 초기화
let chromeService = null; // start()에서 초기화
let chromeTaskHandler = null;

// ==================== 초기화 ====================
const logger = new Logger();
const config = new Config();
const discoveryConfig = loadDiscoveryConfig();

logger.info('╔═══════════════════════════════════════════════════════╗');
logger.info('║                                                       ║');
logger.info('║   🌉 DoAi-Gateway v2.0                                ║');
logger.info('║   Dynamic Device Discovery + WebSocket Multiplexing   ║');
logger.info('║                                                       ║');
logger.info('╚═══════════════════════════════════════════════════════╝');

// ==================== ADB 모듈 ====================
const adbClient = new AdbClient(logger, config);
const deviceTracker = new DeviceTracker(logger, adbClient);
const commander = new Commander(logger, adbClient);
const recovery = new Recovery(logger, adbClient, commander);

// ==================== Dynamic Discovery (v3.0) ====================
const discoveryManager = new DiscoveryManager(logger, adbClient, discoveryConfig);

// ==================== 모니터링 ====================
const heartbeat = new HeartbeatMonitor(logger, commander, deviceTracker);

// ==================== 작업 큐 ====================
const taskQueue = new TaskQueue(logger);
const dispatcher = new Dispatcher(logger, commander, deviceTracker, taskQueue, discoveryManager);

// ==================== WebSocket Multiplexer (v3.0) ====================
const wsMultiplexer = new WebSocketMultiplexer(logger, adbClient, discoveryManager, commander);

// ==================== Stream Server (Legacy) ====================
const streamServer = new StreamServer(logger, adbClient, deviceTracker);

// ==================== H.264 Stream Server (v2.0) ====================
const h264StreamServer = new H264StreamServer({ logger, deviceTracker });

// ==================== Dashboard Handler (NodeContext 프로토콜) ====================
const dashboardHandler = new DashboardHandler({
    logger,
    discoveryManager,
    deviceTracker,
    commander,
    laixiAdapter: null  // start()에서 설정
});

// ==================== Express 서버 ====================
const app = express();

// 미들웨어
app.use(helmet({
    contentSecurityPolicy: false, // Iframe 허용
    crossOriginEmbedderPolicy: false
}));

// CORS 설정 (통합 Control Room)
app.use(cors({
    origin: [
        'http://localhost:3000',      // Vite dev server
        'http://localhost:3100',      // Gateway 자체
        'http://localhost:5176',      // Dashboard dev server
        'https://doai.me',            // 프로덕션 도메인
        'https://gateway.doai.me',    // Gateway 서브도메인
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // 로컬 네트워크
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/   // 내부 네트워크
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' })); // Base64 이미지 처리를 위해 크기 제한 증가

// 정적 파일
app.use('/stream', express.static(path.join(__dirname, '../public/stream')));

// React 클라이언트 (빌드된 파일)
const clientDistPath = path.join(__dirname, '../client/dist');
const clientPublicPath = path.join(__dirname, '../client/public');

// 빌드된 클라이언트가 있으면 서빙
app.use(express.static(clientDistPath));
app.use(express.static(clientPublicPath));

// 컨텍스트 주입
app.use((req, res, next) => {
    req.context = {
        logger,
        config,
        commander,
        deviceTracker,
        discoveryManager,  // v3.0
        taskQueue,
        dispatcher,
        recovery,
        streamServer,
        wsMultiplexer      // v3.0
    };
    next();
});

// 기존 라우터 (v1 - 호환성)
app.use('/api/v1/response', responseRouter);
app.use('/api/v1/command', commandRouter);
app.use('/health', healthRouter);

// Dynamic Device API (v3.0)
app.use('/api/devices', devicesRouter);
app.use('/api/control', controlRouter);
app.use('/api/files', filesRouter);
app.use('/api/dispatch', dispatchRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/stream', streamRouter);

// YouTube API
app.use('/api/youtube', youtubeRouter);

// Kernel API (placeholder for Chrome automation)
app.use('/api/kernel', kernelRouter);

// Chrome Automation API (Puppeteer + CDP over ADB)
app.use('/api/chrome', chromeRouter);

// OpenAI Integration
app.use('/api/ai', aiRouter);

// React SPA 라우팅 (클라이언트 사이드 라우팅 지원)
const fs = require('fs');
app.get('*', (req, res, next) => {
    // API 경로는 제외
    if (req.path.startsWith('/api/') || req.path.startsWith('/stream/') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
        return next();
    }
    
    // 빌드된 index.html 확인
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    
    // 빌드가 없으면 기본 HTML (개발 안내)
    res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DoAi.Me Control Room</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            color: #f0f0f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            border: 1px solid rgba(230, 184, 77, 0.3);
        }
        .logo { font-size: 48px; margin-bottom: 20px; }
        h1 { color: #E6B84D; margin-bottom: 10px; }
        p { color: #888; margin-bottom: 20px; }
        .status { 
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid rgba(34, 197, 94, 0.5);
            border-radius: 20px;
            color: #22c55e;
            font-size: 14px;
        }
        .dot { 
            width: 8px; height: 8px;
            background: #22c55e;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .links { margin-top: 30px; }
        a {
            display: inline-block;
            margin: 5px;
            padding: 10px 20px;
            background: #E6B84D;
            color: #0a0a0f;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
        }
        a:hover { background: #d4a53d; }
        .api-link { background: #333; color: #fff; }
        .api-link:hover { background: #444; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎭</div>
        <h1>DoAi.Me Control Room</h1>
        <p>Gateway v2.0 - Dynamic Device Architecture</p>
        <div class="status">
            <span class="dot"></span>
            Server Running
        </div>
        <div class="links">
            <a href="/api/devices">📱 Devices API</a>
            <a href="/api/discovery/status" class="api-link">🔍 Discovery Status</a>
            <a href="/health" class="api-link">💚 Health Check</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Client not built. Run: <code style="background:#333;padding:2px 6px;border-radius:4px;">cd client && npm run build</code>
        </p>
    </div>
</body>
</html>
    `);
});

// 에러 핸들러
app.use((err, req, res, next) => {
    logger.error('Express 오류', { 
        error: err.message, 
        stack: err.stack 
    });
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: err.message 
    });
});

// ==================== 시작 함수 ====================
async function start() {
    try {
        // 1. ADB 서버 시작
        logger.info('[Gateway] ADB 서버 초기화...');
        await adbClient.initialize();
        logger.info('[Gateway] ✅ ADB 서버 준비');

        // 2. Dynamic Discovery 초기화 (v3.0)
        logger.info('[Gateway] Dynamic Discovery 초기화...');
        await discoveryManager.initialize();
        
        const deviceCount = discoveryManager.getDeviceCount();
        logger.info('[Gateway] ✅ Discovery 완료', deviceCount);

        // Discovery 이벤트 핸들러
        discoveryManager.on('device:added', (device) => {
            logger.info(`[Gateway] 📱 디바이스 발견: ${device.serial} (${device.connectionType})`);
        });

        discoveryManager.on('device:removed', (device) => {
            logger.warn(`[Gateway] 📴 디바이스 오프라인: ${device.serial}`);
        });

        // 3. 기기 추적 시작 (Legacy 호환)
        logger.info('[Gateway] Legacy 기기 추적 시작...');
        await deviceTracker.startTracking();
        
        deviceTracker.on('add', (device) => {
            recovery.scheduleIfNeeded(device);
        });

        deviceTracker.on('remove', (device) => {
            taskQueue.orphanByDevice(device.id);
        });

        // 4. Heartbeat 모니터 시작
        heartbeat.start(30000);
        
        heartbeat.on('timeout', (deviceId) => {
            logger.warn(`[Gateway] ⚠️ Heartbeat 타임아웃: ${deviceId}`);
            recovery.scheduleRecovery(deviceId);
        });

        // 5. Dispatcher 시작
        dispatcher.start();

        // 5.5. Laixi 연결 (Device Control)
        if (process.env.LAIXI_ENABLED === 'true') {
            logger.info('[Gateway] Laixi 연결 초기화...');
            logger.info(`[Gateway]   URL: ${process.env.LAIXI_URL || 'ws://127.0.0.1:22221/'}`);

            laixiAdapter = new LaixiAdapter({
                url: process.env.LAIXI_URL || 'ws://127.0.0.1:22221/',
                timeout: parseInt(process.env.LAIXI_TIMEOUT) || 10000,
                heartbeatInterval: parseInt(process.env.LAIXI_HEARTBEAT_INTERVAL) || 5000,
                logger
            });

            try {
                await laixiAdapter.connect();
                logger.info('[Gateway] ✅ Laixi 연결 성공');
            } catch (err) {
                logger.warn(`[Gateway] ⚠️ Laixi 연결 실패, ADB 모드로 폴백: ${err.message}`);
                laixiAdapter = null;
            }
        } else {
            logger.info('[Gateway] ⏭️ Laixi 비활성화 (ADB 모드)');
        }

        // Initialize Kernel Router with Laixi for YouTube app automation
        initKernelRouter(deviceTracker, laixiAdapter);
        logger.info('[Gateway] ✅ Kernel Router 초기화 완료 (YouTube app automation)');

        // 5.6. Vultr WSS 연결 (v2.1)
        logger.info('[Gateway] Vultr 연결 초기화...');
        const vultrClient = await initVultrConnection({
            adbClient,
            laixiAdapter,  // Laixi 인스턴스 또는 null
            logger,
            config
        });

        if (vultrClient) {
            logger.info('[Gateway] 🌐 Vultr 연결 활성화됨');
        } else {
            logger.info('[Gateway] ⏭️ Vultr 연결 비활성화 (로컬 모드)');
        }

        // 5.7. Chrome Automation Service (Puppeteer + CDP over ADB)
        if (process.env.CHROME_ENABLED === 'true') {
            logger.info('[Gateway] Chrome Automation 초기화...');

            chromeService = createChromeService({
                logger,
                basePort: parseInt(process.env.CHROME_BASE_PORT) || 9300,
                maxConnections: parseInt(process.env.CHROME_MAX_CONNECTIONS) || 50,
                idleTimeout: parseInt(process.env.CHROME_IDLE_TIMEOUT) || 300000
            });

            chromeTaskHandler = new ChromeTaskHandler({
                chromeService,
                logger,
                maxConcurrent: parseInt(process.env.CHROME_MAX_CONCURRENT_TASKS) || 10
            });

            // Initialize Chrome API routes
            initializeChromeRoutes({
                chromeService,
                chromeTaskHandler,
                logger
            });

            chromeService.start();
            logger.info('[Gateway] ✅ Chrome Automation 초기화 완료');
        } else {
            logger.info('[Gateway] ⏭️ Chrome Automation 비활성화');
        }

        // 6. HTTP 서버 및 WebSocket 시작
        const port = config.get('port') || 3100;
        const server = http.createServer(app);
        
        // WebSocket Multiplexer 초기화 (v3.0)
        wsMultiplexer.initialize(server);
        logger.info('[Gateway] 🔌 WebSocket Multiplexer 초기화');
        
        // Legacy Stream 서버 (Iframe용)
        streamServer.initialize(server);
        logger.info('[Gateway] 🎥 Stream 서버 초기화');
        
        // H.264 Real-time Stream 서버 (v2.0)
        // 참고: WSMultiplexer가 /ws/stream/{deviceId} 경로를 이미 처리하므로 비활성화
        // h264StreamServer.initialize(server, '/ws/stream');
        logger.info('[Gateway] 📺 H.264 Stream: WSMultiplexer 사용 (/ws/stream/{deviceId})');

        // Dashboard WebSocket Handler (NodeContext 프로토콜)
        dashboardHandler.initialize(server);
        if (laixiAdapter) {
            dashboardHandler.setLaixiAdapter(laixiAdapter);
        }
        logger.info('[Gateway] 🖥️ Dashboard Handler 초기화 (/ws/dashboard)');

        server.listen(port, () => {
            logger.info(`[Gateway] 🚀 서버 시작: http://0.0.0.0:${port}`);
        });

        // 7. 완료 메시지
        logger.info('═'.repeat(55));
        logger.info('✅ DoAi-Gateway v2.0 Ready');
        logger.info(`📱 발견된 디바이스: ${deviceCount.total}대 (Online: ${deviceCount.online})`);
        logger.info(`🔗 WebSocket: ws://0.0.0.0:${port}/ws`);
        logger.info(`🖥️ Dashboard WS: ws://0.0.0.0:${port}/ws/dashboard`);
        logger.info(`🌐 Dashboard: http://0.0.0.0:${port}/`);
        logger.info('═'.repeat(55));

    } catch (e) {
        logger.error('[Gateway] 시작 실패', { error: e.message, stack: e.stack });
        process.exit(1);
    }
}

// ==================== 종료 처리 ====================
async function shutdown(signal) {
    logger.info(`[Gateway] ${signal} 수신, 종료 중...`);
    
    heartbeat.stop();
    dispatcher.stop();
    if (laixiAdapter) {
        laixiAdapter.disconnect();
        logger.info('[Gateway] Laixi 연결 종료');
    }
    if (chromeService) {
        await chromeService.stop();
        logger.info('[Gateway] Chrome Automation 종료');
    }
    shutdownVultrConnection(); // Vultr 연결 종료
    wsMultiplexer.shutdown();
    dashboardHandler.shutdown();
    streamServer.shutdown();
    h264StreamServer.shutdown();
    discoveryManager.shutdown();
    await deviceTracker.stopTracking();
    
    logger.info('[Gateway] 👋 종료 완료');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ==================== 시작 ====================
start();

