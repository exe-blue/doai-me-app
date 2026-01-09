/**
 * DoAi.Me AutoX.js Main Script
 *
 * Physical Link Layer - Orion 지시 (2024-12-30)
 * 
 * 역할:
 * - Gateway Receiver 시작 및 ADB Broadcast 수신
 * - 메인 폴링 루프 (백그라운드 스레드)
 * - Pop/Accident 명령 처리
 * - Commission/Task 처리
 *
 * 구조:
 * 1. receiver.startListening() 호출 (ADB Broadcast 청취)
 * 2. 메인 루프는 백그라운드 스레드에서 실행
 * 3. 이벤트 루프로 메인 스레드 유지
 *
 * @author Axon (Tech Lead)
 * @version 2.0.0 (Physical Link Layer)
 */

'nodejs';

// ==================== 모듈 임포트 ====================
const Logger = require('./modules/logger.js');
const API = require('./modules/api.js');
const HumanPattern = require('./modules/human.js');
const YouTubeAutomation = require('./modules/youtube.js');
const Receiver = require('./modules/receiver.js');

// ==================== 설정 로드 ====================
const ENV = 'dev'; // 'dev' 또는 'prod'
let config;

try {
    config = JSON.parse(files.read(`./config/${ENV}.json`));
} catch (e) {
    console.error('설정 파일 로드 실패:', e.message);
    // 기본 설정
    config = {
        device: { id: device.serial || 'unknown' },
        server: { host: '127.0.0.1', port: 3100, protocol: 'http' },
        settings: { polling_interval: 30000, log_level: 'info' }
    };
}

// ==================== 모듈 초기화 ====================
const logger = new Logger(config);
const api = new API(config, logger);
const human = new HumanPattern(config, logger);
const youtube = new YouTubeAutomation(config, logger, human);
const receiver = new Receiver(config, logger, youtube);

// ==================== 전역 변수 ====================
let isRunning = true;
let isPaused = false;  // Pop/Accident 처리 중 일시 정지
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 10;

// ==================== Receiver 콜백 등록 ====================

/**
 * 명령 수신 시 메인 루프와 연동
 */
receiver.onCommand((type, payload) => {
    logger.info('📨 [CALLBACK] 명령 수신', { type, payload });

    switch (type) {
        case 'POP':
            // Pop 처리 중에는 메인 루프 일시 정지
            isPaused = true;
            logger.info('[POP] 메인 루프 일시 정지');
            // 5분 후 자동 해제 (안전장치)
            setTimeout(() => { 
                isPaused = false;
                logger.info('[POP] 메인 루프 재개 (타임아웃)');
            }, 300000);
            break;

        case 'ACCIDENT':
            // Accident는 최우선 처리
            isPaused = true;
            logger.warn('[ACCIDENT] 메인 루프 일시 정지 (긴급)');
            // 2분 후 자동 해제
            setTimeout(() => { 
                isPaused = false;
                logger.info('[ACCIDENT] 메인 루프 재개 (타임아웃)');
            }, 120000);
            break;

        case 'COMMISSION':
            // 의뢰 수신 - 의사결정 후 작업 큐에 추가
            logger.info('[COMMISSION] 의뢰 처리', payload);
            if (payload && payload.commission_id) {
                // TODO: DecisionEngine으로 수락/거절 결정
                // 현재는 로그만 출력
                logger.info('[COMMISSION] 수락/거절 결정 필요', {
                    commission_id: payload.commission_id,
                    reward: payload.reward
                });
            }
            break;

        case 'TASK':
            // 직접 작업 할당 (API 폴링 대신)
            if (payload && payload.task) {
                logger.info('[TASK] 직접 작업 할당', payload.task);
                threads.start(function() {
                    const result = performTask(payload.task);
                    api.completeTask(payload.task.task_id, result);
                });
            }
            break;

        case 'STOP':
            logger.warn('[STOP] 중지 명령 - 스크립트 종료');
            isRunning = false;
            break;

        default:
            logger.debug('[UNKNOWN] 처리되지 않은 명령', { type });
    }
});

// ==================== 헬퍼 함수 ====================

/**
 * 작업 수행
 */
function performTask(task) {
    logger.info('═'.repeat(50));
    logger.info('📋 작업 수행 시작', {
        task_id: task.task_id,
        title: task.title,
        keyword: task.keyword,
        youtube_url: task.youtube_url
    });

    const result = {
        success: false,
        watch_duration: 0,
        search_type: null,
        search_rank: null,
        liked: false,
        commented: false,
        subscribed: false,
        notification_set: false,
        shared: false,
        added_to_playlist: false,
        error_message: null
    };

    try {
        // 1. YouTube 앱 실행
        if (!youtube.launchYouTube()) {
            result.error_message = 'YouTube 앱 실행 실패';
            return result;
        }

        sleep(2000);

        // 2. 영상 찾기
        if (task.youtube_url) {
            // URL 직접 열기
            if (!youtube.openByUrl(task.youtube_url)) {
                result.error_message = 'URL 열기 실패';
                return result;
            }
            result.search_type = 0; // 직접 URL
        } else if (task.keyword) {
            // 키워드 검색
            if (!youtube.searchByKeyword(task.keyword)) {
                result.error_message = '검색 실패';
                return result;
            }

            // 검색 결과에서 영상 선택
            const rank = youtube.selectVideoByRank(1); // 첫 번째 영상
            if (!rank) {
                result.error_message = '영상 선택 실패';
                return result;
            }

            result.search_type = 1; // 키워드 검색
            result.search_rank = rank;
        } else {
            result.error_message = 'keyword 또는 youtube_url 없음';
            return result;
        }

        sleep(3000);

        // 3. 영상 시청
        const watchTime = youtube.watchVideo ? youtube.watchVideo(task) : 60;
        if (watchTime === 0) {
            result.error_message = '영상 시청 실패';
            return result;
        }
        result.watch_duration = watchTime;

        // 4. 좋아요 (확률적)
        if (youtube.clickLike) {
            result.liked = youtube.clickLike();
        }

        // 5. 댓글 (확률적)
        if (youtube.writeComment) {
            result.commented = youtube.writeComment();
        }

        // 6. 구독 (확률적)
        if (youtube.clickSubscribe) {
            result.subscribed = youtube.clickSubscribe();
        }

        // 7. 알림 설정 (구독했을 경우에만)
        if (result.subscribed && youtube.setNotification) {
            result.notification_set = youtube.setNotification();
        }

        // 8. 공유 (5% 확률)
        if (Math.random() < 0.05 && youtube.shareVideo) {
            result.shared = youtube.shareVideo();
        }

        // 9. 재생목록 추가 (10% 확률)
        if (Math.random() < 0.1 && youtube.addToPlaylist) {
            result.added_to_playlist = youtube.addToPlaylist();
        }

        // 10. 성공!
        result.success = true;
        logger.info('✅ 작업 수행 완료', {
            task_id: task.task_id,
            watch_duration: result.watch_duration,
            liked: result.liked,
            commented: result.commented,
            subscribed: result.subscribed
        });

    } catch (e) {
        logger.error('❌ 작업 수행 중 예외', {
            task_id: task.task_id,
            error: e.message,
            stack: e.stack
        });
        result.error_message = e.message;
    } finally {
        // YouTube 앱 종료
        if (youtube.closeYouTube) {
            youtube.closeYouTube();
        }
    }

    return result;
}

/**
 * 메인 폴링 루프 (백그라운드 스레드에서 실행)
 * Orion 지시: 메인 루프는 백그라운드에서 돌도록 스레드 처리
 */
function mainLoop() {
    logger.info('📡 메인 폴링 루프 시작 (백그라운드 스레드)');

    while (isRunning) {
        try {
            // Pop/Accident 처리 중이면 대기
            if (isPaused) {
                logger.debug('⏸️ 일시 정지 중 (Pop/Accident 처리)...');
                sleep(5000);
                continue;
            }

            // 1. 서버에서 작업 요청 (폴링)
            const task = api.getNextTask ? api.getNextTask() : null;

            if (task) {
                // 2. 작업 수행
                const result = performTask(task);

                // 3. 결과 보고
                if (api.completeTask) {
                    api.completeTask(task.task_id, result);
                }

                // 4. 연속 에러 카운터 리셋
                consecutiveErrors = 0;
            } else {
                // 대기 중인 작업 없음
                logger.debug('💤 대기 중...');
            }

            // 5. 폴링 간격 대기
            const interval = config.settings?.polling_interval || 30000;
            sleep(interval);

        } catch (e) {
            logger.error('❌ 메인 루프 예외', {
                error: e.message,
                stack: e.stack
            });

            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                logger.error(`연속 ${MAX_CONSECUTIVE_ERRORS}회 오류 발생. 스크립트 종료.`);
                isRunning = false;
            } else {
                logger.warn(`10초 후 재시도... (연속 에러: ${consecutiveErrors})`);
                sleep(10000);
            }
        }
    }

    logger.info('📡 메인 루프 종료됨');
}

// ==================== 시작 함수 ====================

function start() {
    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   🤖 DoAi.Me AutoX.js v2.0                      ║');
    console.log('║   Physical Link Layer                          ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');

    logger.info('🚀 시작');
    logger.info('환경', { env: ENV });
    logger.info('서버', { 
        url: `${config.server?.protocol || 'http'}://${config.server?.host || '127.0.0.1'}:${config.server?.port || 3100}` 
    });
    logger.info('디바이스', { id: config.device?.id || device.serial });

    // 1. 서버 연결 확인 (선택적)
    if (api.healthCheck) {
        const serverOk = api.healthCheck();
        if (!serverOk) {
            logger.warn('서버 연결 확인 실패 - Receiver 모드로 계속');
        } else {
            logger.info('✅ 서버 연결 확인');
        }
    }

    // 2. Receiver 시작 (ADB Broadcast 청취) - Orion 핵심 지시
    logger.info('🎧 Gateway Receiver 시작...');
    try {
        receiver.startListening();
        logger.info('✅ Receiver 청취 중 (com.doai.me.COMMAND)');
    } catch (e) {
        logger.error('Receiver 시작 실패', { error: e.message });
    }

    // 3. 메인 루프를 별도 스레드에서 실행 (Orion 지시)
    logger.info('🔄 메인 폴링 루프 시작 (백그라운드)');
    const mainThread = threads.start(mainLoop);

    // 4. 메인 스레드는 이벤트 루프로 대기
    logger.info('═'.repeat(50));
    logger.info('✅ Physical Link Layer Ready');
    logger.info('🎧 ADB Broadcast 대기 중...');
    logger.info('═'.repeat(50));

    // Keep-alive (메인 스레드가 종료되지 않도록)
    setInterval(function() {
        if (!isRunning) {
            logger.info('🛑 종료 요청 감지 - 스크립트 종료');
            receiver.stopListening();
            exit();
        }
    }, 10000);
}

// ==================== 종료 핸들러 ====================

events.on('exit', function() {
    logger.info('🛑 종료 신호 수신');
    isRunning = false;

    // Receiver 정리
    receiver.stopListening();

    // YouTube 앱 종료
    if (youtube.closeYouTube) {
        youtube.closeYouTube();
    }
});

// stop_requested 이벤트 (Receiver에서 발생)
events.broadcast.on('stop_requested', function(data) {
    logger.warn('🛑 중지 요청 수신', data);
    isRunning = false;
});

// ==================== 실행 ====================
start();
