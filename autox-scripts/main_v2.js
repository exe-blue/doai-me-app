/**
 * DoAi-Client Main Entry Point
 * 
 * Aria 명세서 (2025-01-15) 준수
 * 
 * 모듈 구조:
 * - /core/receiver.js   : ADB Broadcast 수신
 * - /core/router.js     : 메시지 라우팅 (Priority Queue)
 * - /core/state.js      : 상태 관리
 * - /handlers/*         : 타입별 핸들러
 * - /services/*         : YouTube, UI, Network
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

'nodejs';

// ==================== 배너 ====================
console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║                                                       ║');
console.log('║   🤖 DoAi.Me Client v2.0                              ║');
console.log('║   Gateway-Client Communication Protocol               ║');
console.log('║                                                       ║');
console.log('║   Intent: org.anthropic.doaime.COMMAND               ║');
console.log('║                                                       ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

// ==================== 설정 로드 ====================
const ENV = 'dev'; // 'dev' 또는 'prod'
let config;

try {
    config = JSON.parse(files.read(`./config/${ENV}.json`));
} catch (e) {
    console.warn('[Main] 설정 파일 로드 실패, 기본 설정 사용');
    config = {
        device: { id: device.serial || 'unknown' },
        server: { host: '127.0.0.1', port: 3100, protocol: 'http' },
        settings: { log_level: 'info' }
    };
}

// ==================== Core 모듈 로드 ====================
const Logger = require('./modules/logger.js');
const Receiver = require('./core/receiver.js');
const Router = require('./core/router.js');
const StateManager = require('./core/state.js');

// ==================== Handler 모듈 로드 ====================
const PopHandler = require('./handlers/pop_handler.js');
const AccidentHandler = require('./handlers/accident_handler.js');
const CommissionHandler = require('./handlers/commission_handler.js');
const SystemHandler = require('./handlers/system_handler.js');

// ==================== Service 모듈 로드 ====================
const YouTube = require('./modules/youtube.js');
const UIService = require('./services/ui.js');
const NetworkService = require('./services/network.js');

// ==================== 인스턴스 생성 ====================
const logger = new Logger(config.settings?.log_level || 'info');

// State Manager
const state = new StateManager(logger);
state.initialize();

// Services
const youtube = new YouTube(config, logger);
const ui = new UIService(logger);
const network = new NetworkService(logger, config);

// Handlers
const popHandler = new PopHandler(logger, youtube, state);
const accidentHandler = new AccidentHandler(logger, youtube, state);
const commissionHandler = new CommissionHandler(logger, youtube, ui, state, null);
const systemHandler = new SystemHandler(logger, state, network);

// Router
const router = new Router(logger, state);
router.registerHandler('POP', popHandler);
router.registerHandler('ACCIDENT', accidentHandler);
router.registerHandler('COMMISSION', commissionHandler);
router.registerHandler('SYSTEM', systemHandler);

// Receiver
const receiver = new Receiver(logger);
receiver.onMessage((message) => {
    router.route(message);
});

// ==================== 글로벌 상태 ====================
let isRunning = true;
let isShuttingDown = false;
let keepAliveIntervalId = null;
let watchdogIntervalId = null;  // Watchdog interval ID 저장

// ==================== Application Watchdog ====================
/**
 * Layer 1: Application Watchdog (10초 간격)
 * 자체 상태 검사, 메인 루프 멈춤 감지
 * 
 * 개선사항:
 * - interval ID 저장으로 정리 가능
 * - 중복 실행 방지
 * - shutdown 시 interval 정리
 */
function startWatchdog() {
    // 이미 실행 중이면 중복 생성 방지
    if (watchdogIntervalId !== null) {
        logger.warn('[Watchdog] 이미 실행 중, 중복 생성 방지');
        return;
    }
    
    watchdogIntervalId = setInterval(() => {
        if (!isRunning) return;
        
        // 상태 검사
        const currentTask = state.getCurrentTask();
        if (currentTask) {
            const elapsed = Date.now() - currentTask.startedAt;
            const timeout = 5 * 60 * 1000; // 5분
            
            if (elapsed > timeout) {
                logger.warn('[Watchdog] 작업 타임아웃 감지', {
                    task_id: currentTask.id,
                    elapsed_sec: Math.floor(elapsed / 1000)
                });
                state.clearCurrentTask();
            }
        }

        // 에러 카운트 체크
        const metrics = state.getMetrics();
        if (metrics.error_count >= 10) {
            logger.warn('[Watchdog] 에러 누적 감지, 리셋');
            state.resetErrorCount();
        }
    }, 10000);
    
    logger.debug('[Watchdog] 시작됨');
}

// ==================== 시작 함수 ====================
function start() {
    logger.info('🚀 DoAi-Client 시작');
    logger.info('환경', { env: ENV });
    logger.info('디바이스', { id: config.device?.id || device.serial });

    // 1. Gateway 연결 확인 (선택적)
    const serverOk = network.healthCheck();
    if (!serverOk) {
        logger.warn('[Main] Gateway 연결 실패 - 오프라인 모드');
    } else {
        logger.info('[Main] ✅ Gateway 연결 확인');
        
        // 오프라인 큐 처리
        network.processOfflineQueue();
    }

    // 2. Receiver 시작
    logger.info('🎧 Receiver 시작...');
    try {
        receiver.startListening();
        logger.info('[Main] ✅ Receiver 청취 중');
    } catch (e) {
        logger.error('[Main] Receiver 시작 실패', { error: e.message });
    }

    // 3. Router 처리 시작
    router.startProcessing();

    // 4. Watchdog 시작
    startWatchdog();

    // 5. 완료 메시지
    logger.info('═'.repeat(55));
    logger.info('✅ DoAi-Client Ready');
    logger.info('🎧 Intent: org.anthropic.doaime.COMMAND');
    logger.info('═'.repeat(55));

    // Keep-alive
    keepAliveIntervalId = setInterval(() => {
        if (!isRunning) {
            logger.info('🛑 종료 요청 감지');
            shutdown();
        }
    }, 5000);
}

// ==================== 종료 함수 ====================
function shutdown() {
    // idempotent: 이미 종료 중이면 무시
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    
    logger.info('[Main] 종료 중...');
    
    // watchdog 인터벌 정리 (리소스 누수 방지)
    if (watchdogIntervalId !== null) {
        clearInterval(watchdogIntervalId);
        watchdogIntervalId = null;
        logger.debug('[Watchdog] 정리됨');
    }
    
    // keep-alive 인터벌 정리
    if (keepAliveIntervalId) {
        clearInterval(keepAliveIntervalId);
        keepAliveIntervalId = null;
    }
    
    receiver.stopListening();
    router.stopProcessing();
    state.shutdown();
    
    if (youtube.closeYouTube) {
        youtube.closeYouTube();
    }
    
    logger.info('[Main] 👋 종료 완료');
    exit();
}

// ==================== 이벤트 핸들러 ====================
events.on('exit', () => {
    logger.info('🛑 종료 신호 수신');
    isRunning = false;
    // shutdown은 keep-alive 루프 또는 여기서 한 번만 호출됨
    shutdown();
});

events.broadcast.on('stop_requested', (data) => {
    logger.warn('🛑 중지 요청 수신', data);
    isRunning = false;
});

// ==================== 시작 ====================
start();

