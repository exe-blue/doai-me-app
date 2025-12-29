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

// Stream Server (Legacy, Iframe용)
const StreamServer = require('./stream/server');

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
const dispatcher = new Dispatcher(logger, commander, deviceTracker, taskQueue);

// ==================== WebSocket Multiplexer (v3.0) ====================
const wsMultiplexer = new WebSocketMultiplexer(logger, adbClient, discoveryManager, commander);

// ==================== Stream Server (Legacy) ====================
const streamServer = new StreamServer(logger, adbClient, deviceTracker);

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
        'https://doai.me',            // 프로덕션 도메인
        'https://gateway.doai.me',    // Gateway 서브도메인
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // 로컬 네트워크
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/   // 내부 네트워크
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 정적 파일
app.use('/stream', express.static('public/stream'));

// React 클라이언트 (빌드된 파일)
app.use(express.static(path.join(__dirname, '../client/dist')));

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
app.use('/api/discovery', discoveryRouter);  // v3.0
app.use('/stream', streamRouter);

// React SPA 라우팅 (클라이언트 사이드 라우팅 지원)
app.get('*', (req, res, next) => {
    // API 경로는 제외
    if (req.path.startsWith('/api/') || req.path.startsWith('/stream/') || req.path.startsWith('/ws')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
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

        // 6. HTTP 서버 및 WebSocket 시작
        const port = config.get('port') || 3100;
        const server = http.createServer(app);
        
        // WebSocket Multiplexer 초기화 (v3.0)
        wsMultiplexer.initialize(server);
        logger.info('[Gateway] 🔌 WebSocket Multiplexer 초기화');
        
        // Legacy Stream 서버 (Iframe용)
        streamServer.initialize(server);
        logger.info('[Gateway] 🎥 Stream 서버 초기화');
        
        server.listen(port, () => {
            logger.info(`[Gateway] 🚀 서버 시작: http://0.0.0.0:${port}`);
        });

        // 7. 완료 메시지
        logger.info('═'.repeat(55));
        logger.info('✅ DoAi-Gateway v2.0 Ready');
        logger.info(`📱 발견된 디바이스: ${deviceCount.total}대 (Online: ${deviceCount.online})`);
        logger.info(`🔗 WebSocket: ws://0.0.0.0:${port}/ws`);
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
    wsMultiplexer.shutdown();
    streamServer.shutdown();
    discoveryManager.shutdown();
    await deviceTracker.stopTracking();
    
    logger.info('[Gateway] 👋 종료 완료');
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ==================== 시작 ====================
start();

