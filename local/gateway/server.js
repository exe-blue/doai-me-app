/**
 * DoAi.Me Gateway Server
 * 
 * 역할: 600대 Android 기기 연결 관리 및 명령 전송
 * 기술: Express + @devicefarmer/adbkit
 * 
 * Physical Link Layer - Orion 지시 (2024-12-30)
 * - Device Tracking: client.trackDevices()로 실시간 연결/해제 로그
 * - Command Dispatcher: POST /dispatch로 ADB Broadcast 전송
 * - 명령 포맷: am broadcast -a com.doai.me.COMMAND --es type "..." --es payload '...'
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const adb = require('@devicefarmer/adbkit');
const winston = require('winston');
const fs = require('fs');

// ============================================
// 상수 정의
// ============================================
const BROADCAST_ACTION = 'com.doai.me.COMMAND';

// 명령 타입 (Orion 정의)
const CommandType = {
    POP: 'POP',             // Pop 영상 시청
    ACCIDENT: 'ACCIDENT',   // 긴급 사회적 반응
    COMMISSION: 'COMMISSION', // 의뢰 할당
    TASK: 'TASK',           // 일반 작업
    CALL: 'CALL',           // 페르소나 호출
    STOP: 'STOP'            // 중지 명령
};

// ============================================
// 로거 설정
// ============================================
// 로그 디렉토리 생성
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: 'logs/gateway.log' }),
        new winston.transports.File({ filename: 'logs/gateway-error.log', level: 'error' })
    ]
});

// ============================================
// ADB 클라이언트 초기화
// ============================================
const client = adb.createClient({
    host: process.env.ADB_HOST || '127.0.0.1',
    port: parseInt(process.env.ADB_PORT) || 5037
});

// 연결된 기기 목록 (실시간 추적)
const connectedDevices = new Map();

// ============================================
// 기기 실시간 추적 (Orion 핵심 요구사항)
// ============================================
async function startDeviceTracking() {
    try {
        const tracker = await client.trackDevices();

        tracker.on('add', (device) => {
            const timestamp = new Date().toISOString();
            logger.info(`🔌 [DEVICE CONNECTED] ${device.id}`, {
                deviceId: device.id,
                type: device.type,
                timestamp
            });
            
            connectedDevices.set(device.id, {
                id: device.id,
                type: device.type,
                connectedAt: timestamp,
                status: device.type === 'device' ? 'online' : device.type,
                lastCommand: null
            });
        });

        tracker.on('remove', (device) => {
            logger.warn(`⚡ [DEVICE DISCONNECTED] ${device.id}`, {
                deviceId: device.id,
                timestamp: new Date().toISOString()
            });
            connectedDevices.delete(device.id);
        });

        tracker.on('change', (device) => {
            logger.info(`🔄 [DEVICE CHANGED] ${device.id}`, {
                deviceId: device.id,
                type: device.type
            });
            
            if (connectedDevices.has(device.id)) {
                const existing = connectedDevices.get(device.id);
                existing.type = device.type;
                existing.status = device.type === 'device' ? 'online' : device.type;
            }
        });

        tracker.on('end', () => {
            logger.error('❌ ADB 연결 종료됨. 5초 후 재연결...');
            setTimeout(startDeviceTracking, 5000);
        });

        tracker.on('error', (err) => {
            logger.error('❌ ADB 트래커 오류', { error: err.message });
            setTimeout(startDeviceTracking, 5000);
        });

        // 초기 기기 목록 로드
        const devices = await client.listDevices();
        devices.forEach(device => {
            connectedDevices.set(device.id, {
                id: device.id,
                type: device.type,
                connectedAt: new Date().toISOString(),
                status: device.type === 'device' ? 'online' : device.type,
                lastCommand: null
            });
            logger.info(`📱 [INITIAL DEVICE] ${device.id}`, { type: device.type });
        });

        logger.info(`🚀 ADB Device Tracking 시작`, {
            connectedDevices: connectedDevices.size,
            adbHost: process.env.ADB_HOST || '127.0.0.1',
            adbPort: process.env.ADB_PORT || 5037
        });

    } catch (error) {
        logger.error('❌ ADB 트래커 시작 실패', { error: error.message });
        logger.info('5초 후 재시도...');
        setTimeout(startDeviceTracking, 5000);
    }
}

// ============================================
// ADB Broadcast 전송 함수
// ============================================
/**
 * 기기에 Broadcast Intent 전송
 * 
 * 명령어 포맷 (Orion 지시):
 * am broadcast -a com.doai.me.COMMAND --es type "POP" --es payload '{"url":"..."}'
 * 
 * @param {string} deviceId - 대상 기기 ID
 * @param {string} type - 명령 타입 (POP, ACCIDENT, COMMISSION 등)
 * @param {object} payload - 명령 페이로드
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
async function sendBroadcast(deviceId, type, payload) {
    if (!connectedDevices.has(deviceId)) {
        return { success: false, error: '기기가 연결되어 있지 않음' };
    }

    try {
        // payload를 JSON 문자열로 변환 (작은따옴표로 감싸기)
        const payloadJson = JSON.stringify(payload).replace(/"/g, '\\"');
        
        // Orion 지시 명령어 포맷
        const broadcastCmd = `am broadcast -a ${BROADCAST_ACTION} --es type "${type}" --es payload "${payloadJson}"`;
        
        logger.debug('Broadcast 명령', { deviceId, command: broadcastCmd });

        const device = client.getDevice(deviceId);
        const output = await device.shell(broadcastCmd);
        const result = await adb.util.readAll(output);
        const resultStr = result.toString().trim();

        // 명령 기록
        if (connectedDevices.has(deviceId)) {
            connectedDevices.get(deviceId).lastCommand = {
                type,
                payload,
                sentAt: new Date().toISOString()
            };
        }

        return { success: true, output: resultStr };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// Express 서버 설정
// ============================================
const app = express();
app.use(cors());
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    if (req.method === 'POST') {
        logger.info(`📨 ${req.method} ${req.path}`, { body: req.body });
    } else {
        logger.debug(`${req.method} ${req.path}`);
    }
    next();
});

// ============================================
// API 엔드포인트
// ============================================

/**
 * GET /health
 * 서버 상태 확인
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'DoAi.Me Gateway',
        connectedDevices: connectedDevices.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /devices
 * 연결된 모든 기기 목록 반환
 */
app.get('/devices', (req, res) => {
    const devices = Array.from(connectedDevices.values());
    res.json({
        count: devices.length,
        devices: devices
    });
});

/**
 * GET /devices/:id
 * 특정 기기 상태 조회
 */
app.get('/devices/:id', (req, res) => {
    const device = connectedDevices.get(req.params.id);
    if (!device) {
        return res.status(404).json({ 
            success: false,
            error: '기기를 찾을 수 없습니다', 
            deviceId: req.params.id 
        });
    }
    res.json({ success: true, device });
});

/**
 * POST /dispatch
 * 기기에 명령 전송 (Orion 지시 포맷)
 * 
 * Body:
 * {
 *   "target_ids": ["device_1", "device_2"] | "all",
 *   "type": "POP" | "ACCIDENT" | "COMMISSION" | "TASK" | "CALL" | "STOP",
 *   "payload": { "url": "...", ... }
 * }
 * 
 * 예시 - 20대 동시 POP:
 * {
 *   "target_ids": "all",
 *   "type": "POP",
 *   "payload": { "url": "https://youtube.com/watch?v=...", "title": "..." }
 * }
 */
app.post('/dispatch', async (req, res) => {
    const { target_ids, type, payload } = req.body;

    // 필수 파라미터 검증
    if (!target_ids) {
        return res.status(400).json({ 
            success: false,
            error: 'target_ids는 필수입니다 (배열 또는 "all")' 
        });
    }

    if (!type || !Object.values(CommandType).includes(type)) {
        return res.status(400).json({ 
            success: false,
            error: `type은 필수입니다 (${Object.values(CommandType).join(', ')})` 
        });
    }

    // 대상 기기 결정
    let targetDevices;
    if (target_ids === 'all') {
        targetDevices = Array.from(connectedDevices.keys());
    } else if (Array.isArray(target_ids)) {
        targetDevices = target_ids;
    } else {
        targetDevices = [target_ids];
    }

    if (targetDevices.length === 0) {
        return res.status(400).json({
            success: false,
            error: '연결된 기기가 없습니다'
        });
    }

    logger.info(`📤 [DISPATCH] ${type} → ${targetDevices.length}대`, {
        type,
        targetCount: targetDevices.length,
        payload
    });

    // 비동기적으로 모든 기기에 전송
    const results = await Promise.all(
        targetDevices.map(async (deviceId) => {
            const result = await sendBroadcast(deviceId, type, payload || {});
            return {
                deviceId,
                ...result
            };
        })
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    logger.info(`📊 [DISPATCH RESULT] 성공: ${successCount}, 실패: ${failCount}`);

    res.json({
        success: successCount > 0,
        totalTargets: targetDevices.length,
        successCount,
        failCount,
        results
    });
});

/**
 * POST /dispatch/pop
 * POP 명령 전용 엔드포인트 (편의용)
 */
app.post('/dispatch/pop', async (req, res) => {
    const { target_ids, url, title, channel } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'url은 필수입니다' });
    }

    req.body = {
        target_ids: target_ids || 'all',
        type: CommandType.POP,
        payload: { url, title, channel }
    };

    // /dispatch 핸들러로 위임
    return app._router.handle(req, res, () => {});
});

/**
 * POST /dispatch/accident
 * ACCIDENT 명령 전용 엔드포인트 (편의용)
 */
app.post('/dispatch/accident', async (req, res) => {
    const { target_ids, url, title, severity, response_template } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'url은 필수입니다' });
    }

    req.body = {
        target_ids: target_ids || 'all',
        type: CommandType.ACCIDENT,
        payload: { url, title, severity: severity || 5, response_template }
    };

    return app._router.handle(req, res, () => {});
});

/**
 * POST /shell
 * 기기에 직접 Shell 명령 실행
 */
app.post('/shell', async (req, res) => {
    const { deviceId, command } = req.body;

    if (!deviceId || !command) {
        return res.status(400).json({ 
            success: false,
            error: 'deviceId와 command는 필수입니다' 
        });
    }

    if (!connectedDevices.has(deviceId)) {
        return res.status(404).json({ 
            success: false,
            error: '기기가 연결되어 있지 않습니다' 
        });
    }

    try {
        const device = client.getDevice(deviceId);
        const output = await device.shell(command);
        const result = await adb.util.readAll(output);

        res.json({
            success: true,
            deviceId,
            command,
            output: result.toString()
        });
    } catch (error) {
        logger.error('Shell 명령 실패', { deviceId, command, error: error.message });
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

/**
 * POST /init/:id
 * 특정 기기 초기화 (폰보드 환경 최적화)
 */
app.post('/init/:id', async (req, res) => {
    const deviceId = req.params.id;

    if (!connectedDevices.has(deviceId)) {
        return res.status(404).json({
            success: false,
            error: '기기가 연결되어 있지 않습니다'
        });
    }

    const initCommands = [
        'dumpsys deviceidle disable',                           // Doze 모드 비활성화
        'settings put global stay_on_while_plugged_in 3',       // 화면 항상 켜짐
        'input keyevent 82',                                     // 잠금 해제 시도
        'settings put system screen_brightness 10',             // 화면 밝기 최소
        'settings put global wifi_sleep_policy 2'               // WiFi 절전 끄기
    ];

    const results = [];
    const device = client.getDevice(deviceId);

    for (const cmd of initCommands) {
        try {
            const output = await device.shell(cmd);
            const result = await adb.util.readAll(output);
            results.push({ command: cmd, success: true, output: result.toString().trim() });
            logger.info(`초기화 명령 성공: ${cmd}`, { deviceId });
        } catch (error) {
            results.push({ command: cmd, success: false, error: error.message });
            logger.error(`초기화 명령 실패: ${cmd}`, { deviceId, error: error.message });
        }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
        success: successCount === initCommands.length,
        deviceId,
        totalCommands: initCommands.length,
        successCount,
        results
    });
});

/**
 * POST /init
 * 모든 기기 초기화
 */
app.post('/init', async (req, res) => {
    const deviceIds = Array.from(connectedDevices.keys());

    if (deviceIds.length === 0) {
        return res.status(400).json({
            success: false,
            error: '연결된 기기가 없습니다'
        });
    }

    logger.info(`🔧 모든 기기 초기화 시작 (${deviceIds.length}대)`);

    const results = [];

    for (const deviceId of deviceIds) {
        // /init/:id 엔드포인트 내부 로직 재사용
        const initCommands = [
            'dumpsys deviceidle disable',
            'settings put global stay_on_while_plugged_in 3',
            'input keyevent 82',
            'settings put system screen_brightness 10'
        ];

        const device = client.getDevice(deviceId);
        let successCount = 0;

        for (const cmd of initCommands) {
            try {
                await device.shell(cmd);
                successCount++;
            } catch (error) {
                logger.warn(`초기화 명령 실패`, { deviceId, command: cmd, error: error.message });
            }
        }

        results.push({
            deviceId,
            success: successCount === initCommands.length,
            commandsRun: initCommands.length,
            successCount
        });
    }

    const totalSuccess = results.filter(r => r.success).length;

    res.json({
        success: totalSuccess > 0,
        totalDevices: deviceIds.length,
        successfulDevices: totalSuccess,
        results
    });
});

// ============================================
// 에러 핸들러
// ============================================
app.use((err, req, res, next) => {
    logger.error('서버 에러', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not Found' });
});

// ============================================
// 서버 시작
// ============================================
const PORT = process.env.GATEWAY_PORT || 3100;

app.listen(PORT, async () => {
    logger.info('═'.repeat(60));
    logger.info('🌐 DoAi.Me Gateway Server');
    logger.info('═'.repeat(60));
    logger.info(`📡 Port: ${PORT}`);
    logger.info(`🔗 Broadcast Action: ${BROADCAST_ACTION}`);
    logger.info(`📂 Command Types: ${Object.values(CommandType).join(', ')}`);
    logger.info('═'.repeat(60));

    // ADB 기기 추적 시작
    await startDeviceTracking();
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
    logger.info('👋 서버 종료 중...');
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason });
});

// 모듈 내보내기 (테스트용)
module.exports = { app, CommandType, BROADCAST_ACTION };
