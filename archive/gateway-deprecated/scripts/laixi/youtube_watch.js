/**
 * DoAi.ME YouTube 자동화 스크립트
 * 
 * Laixi + AutoX.js 환경에서 실행
 * 
 * 기능:
 * - YouTube 영상 시청
 * - 좋아요/싫어요
 * - 댓글 작성 (로그인 필요)
 * - 구독 (로그인 필요)
 * - 로그인 상태 감지
 * 
 * 사용법:
 * 1. Laixi에서 이 스크립트를 디바이스에 푸시
 * 2. 또는 Gateway Bridge를 통해 원격 실행
 * 
 * 파라미터 (engines.myEngine().execArgv로 전달):
 * - videoUrl: YouTube URL
 * - videoId: DoAi.ME 비디오 ID
 * - minWatchSeconds: 최소 시청 시간 (초)
 * - maxWatchSeconds: 최대 시청 시간 (초)
 * - like: 좋아요 여부 (true/false)
 * - comment: 댓글 내용 (null이면 생략)
 * - subscribe: 구독 여부 (true/false)
 * - requireLogin: 로그인 필수 여부 (true/false)
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

"ui";

// ============================================================
// 설정
// ============================================================

const CONFIG = {
    // 기본값
    DEFAULT_MIN_WATCH: 30,
    DEFAULT_MAX_WATCH: 180,
    
    // YouTube 패키지
    YOUTUBE_PACKAGE: 'com.google.android.youtube',
    
    // 대기 시간 (ms)
    APP_LOAD_DELAY: 5000,
    VIDEO_LOAD_DELAY: 6000,
    ACTION_DELAY: 800,
    SCROLL_DELAY: 1000,
    
    // UI 요소 대기 최대 시간 (ms)
    UI_TIMEOUT: 10000,
    
    // 재시도
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    
    // 버튼 위치 (상대 좌표 - 디바이스별로 조정 필요)
    UI_POSITIONS: {
        // 좋아요 버튼 (영상 아래)
        like: { x: 0.08, y: 0.72 },
        // 싫어요 버튼
        dislike: { x: 0.18, y: 0.72 },
        // 구독 버튼
        subscribe: { x: 0.85, y: 0.60 },
        // 댓글 버튼
        comment: { x: 0.50, y: 0.72 },
        // 댓글 입력창
        commentInput: { x: 0.50, y: 0.90 },
        // 댓글 전송
        commentSend: { x: 0.90, y: 0.90 },
        // 프로필 (로그인 체크용)
        profile: { x: 0.92, y: 0.06 },
    },
};

// ============================================================
// 유틸리티
// ============================================================

/**
 * 랜덤 숫자 생성
 */
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 대기
 */
function sleep(ms) {
    java.lang.Thread.sleep(ms);
}

/**
 * 로그 출력
 */
function log(message, level = 'info') {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const logMsg = `[${timestamp}] [DoAi] ${message}`;
    
    console.log(logMsg);
    
    // Toast는 중요한 메시지만 표시
    if (level === 'success' || level === 'error') {
        toast(message);
    }
}

/**
 * 파라미터 파싱
 */
function parseParams() {
    // engines.myEngine().execArgv로 전달받은 인자
    const args = engines.myEngine().execArgv || {};
    
    return {
        videoUrl: args.videoUrl || args.video_url || null,
        videoId: args.videoId || args.video_id || `video_${Date.now()}`,
        minWatchSeconds: parseInt(args.minWatchSeconds || args.min_watch_seconds || CONFIG.DEFAULT_MIN_WATCH),
        maxWatchSeconds: parseInt(args.maxWatchSeconds || args.max_watch_seconds || CONFIG.DEFAULT_MAX_WATCH),
        like: args.like === true || args.like === 'true',
        dislike: args.dislike === true || args.dislike === 'true',
        subscribe: args.subscribe === true || args.subscribe === 'true',
        comment: args.comment || null,
        requireLogin: args.requireLogin === true || args.requireLogin === 'true',
        skipAds: args.skipAds !== false && args.skipAds !== 'false',
    };
}

/**
 * 화면 터치
 */
function tap(relativeX, relativeY, description = '') {
    const x = Math.floor(device.width * relativeX);
    const y = Math.floor(device.height * relativeY);
    
    log(`탭: ${description || ''} (${x}, ${y})`);
    click(x, y);
    sleep(CONFIG.ACTION_DELAY);
}

/**
 * 스와이프
 */
function swipeScreen(direction = 'up', duration = 400) {
    const centerX = device.width / 2;
    const centerY = device.height / 2;
    
    let startY, endY;
    
    if (direction === 'up') {
        startY = device.height * 0.7;
        endY = device.height * 0.3;
    } else {
        startY = device.height * 0.3;
        endY = device.height * 0.7;
    }
    
    swipe(centerX, startY, centerX, endY, duration);
    sleep(CONFIG.SCROLL_DELAY);
}

// ============================================================
// 로그인 체크
// ============================================================

/**
 * 로그인 상태 확인
 */
function checkLoginStatus() {
    log('로그인 상태 확인 중...');
    
    // YouTube 앱에서 프로필 아이콘 확인
    // 로그인된 경우 프로필 사진, 미로그인시 기본 아이콘
    
    // 방법 1: UI Automator로 특정 요소 찾기
    try {
        // "로그인" 텍스트가 있으면 미로그인
        const loginBtn = text("로그인").findOne(3000);
        if (loginBtn) {
            log('로그인 필요 (로그인 버튼 발견)');
            return false;
        }
    } catch (e) {
        // 무시
    }
    
    try {
        // 계정 전환 메뉴가 있으면 로그인됨
        const accountSwitch = descContains("계정").findOne(2000);
        if (accountSwitch) {
            log('로그인됨 (계정 메뉴 발견)', 'success');
            return true;
        }
    } catch (e) {
        // 무시
    }
    
    // 방법 2: 프로필 아이콘 클릭해서 확인
    try {
        tap(CONFIG.UI_POSITIONS.profile.x, CONFIG.UI_POSITIONS.profile.y, '프로필');
        sleep(1500);
        
        // "로그인" 버튼이 보이면 미로그인
        const loginPrompt = text("로그인").findOne(2000);
        if (loginPrompt) {
            back(); // 뒤로가기
            sleep(500);
            log('로그인 필요');
            return false;
        }
        
        back(); // 뒤로가기
        sleep(500);
        log('로그인됨', 'success');
        return true;
    } catch (e) {
        log('로그인 상태 확인 실패: ' + e.message);
        try {
            back(); // 예외 발생 시에도 뒤로가기 시도
            sleep(500);
        } catch (backError) {
            // 뒤로가기 실패 무시
        }
        return false; // 확인 불가 시 미로그인으로 처리
    }
// ============================================================
// YouTube 제어
// ============================================================

/**
 * YouTube 앱 열기
 */
function openYouTube() {
    log('YouTube 앱 열기...');
    
    // 앱 실행
    app.launchPackage(CONFIG.YOUTUBE_PACKAGE);
    sleep(CONFIG.APP_LOAD_DELAY);
    
    // 앱이 열렸는지 확인
    for (let i = 0; i < 5; i++) {
        if (currentPackage() === CONFIG.YOUTUBE_PACKAGE) {
            log('YouTube 앱 열림', 'success');
            return true;
        }
        sleep(1000);
    }
    
    log('YouTube 앱 실행 실패', 'error');
    return false;
}

/**
 * URL로 영상 열기
 */
function openVideoByUrl(url) {
    log(`영상 열기: ${url}`);
    
    try {
        // Intent로 열기
        app.startActivity({
            action: 'android.intent.action.VIEW',
            data: url,
            packageName: CONFIG.YOUTUBE_PACKAGE,
        });
        
        sleep(CONFIG.VIDEO_LOAD_DELAY);
        
        // 영상이 로드되었는지 확인
        if (currentPackage() !== CONFIG.YOUTUBE_PACKAGE) {
            log('YouTube가 열리지 않음');
            return false;
        }
        
        log('영상 로드 완료', 'success');
        return true;
    } catch (e) {
        log('영상 열기 실패: ' + e.message, 'error');
        return false;
    }
}

/**
 * 광고 스킵
 */
function skipAdsIfPresent() {
    log('광고 확인 중...');
    
    const skipTexts = ['광고 건너뛰기', 'Skip Ad', 'Skip Ads', '건너뛰기'];
    
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const skipText of skipTexts) {
            try {
                const skipBtn = text(skipText).findOne(1000);
                if (skipBtn) {
                    log('광고 건너뛰기 버튼 발견');
                    skipBtn.click();
                    sleep(1000);
                    return true;
                }
            } catch (e) {
                // 무시
            }
            
            try {
                const skipBtn = desc(skipText).findOne(500);
                if (skipBtn) {
                    log('광고 건너뛰기 버튼 발견 (desc)');
                    skipBtn.click();
                    sleep(1000);
                    return true;
                }
            } catch (e) {
                // 무시
            }
        }
        
        sleep(2000);
    }
    
    log('광고 없음 또는 스킵 불가');
    return false;
}

/**
 * 영상 시청 (대기)
 */
function watchVideo(seconds) {
    log(`영상 시청 중... (${seconds}초)`);
    
    // 화면 켜짐 유지
    device.keepScreenDim(seconds * 1000 + 10000);
    
    // 간헐적으로 화면 터치 (시청 유지)
    const checkInterval = 30; // 30초마다
    let watched = 0;
    
    while (watched < seconds) {
        const sleepTime = Math.min(checkInterval, seconds - watched);
        sleep(sleepTime * 1000);
        watched += sleepTime;
        
        // 광고 스킵 체크
        skipAdsIfPresent();
        
        // 화면 중앙 살짝 터치 (재생 유지)
        if (Math.random() > 0.7) {
            click(device.width * 0.5, device.height * 0.4);
            sleep(500);
            click(device.width * 0.5, device.height * 0.4);
        }
        
        log(`시청 진행: ${watched}/${seconds}초`);
    }
    
    log('시청 완료', 'success');
    return true;
}

/**
 * 좋아요 누르기
 */
function likeVideo() {
    log('좋아요 누르기...');
    
    try {
        // UI Automator로 좋아요 버튼 찾기
        const likeBtn = descContains("like").findOne(3000) || 
                        descContains("좋아요").findOne(2000);
        
        if (likeBtn) {
            likeBtn.click();
            sleep(CONFIG.ACTION_DELAY);
            log('좋아요 완료 (UI)', 'success');
            return true;
        }
    } catch (e) {
        // UI로 찾지 못하면 좌표로 시도
    }
    
    // 좌표 기반 클릭
    tap(CONFIG.UI_POSITIONS.like.x, CONFIG.UI_POSITIONS.like.y, '좋아요');
    log('좋아요 완료 (좌표)', 'success');
    return true;
}

/**
 * 댓글 작성
 */
function writeComment(commentText) {
    if (!commentText) {
        log('댓글 내용 없음, 건너뜀');
        return false;
    }
    
    log(`댓글 작성: ${commentText}`);
    
    try {
        // 댓글 영역으로 스크롤
        swipeScreen('up');
        sleep(1000);
        
        // 댓글 입력창 찾기
        const commentBox = descContains("댓글").findOne(3000) ||
                          textContains("공개 댓글").findOne(2000);
        
        if (commentBox) {
            commentBox.click();
            sleep(1000);
            
            // 텍스트 입력
            const inputField = className("EditText").findOne(3000);
            if (inputField) {
                inputField.setText(commentText);
                sleep(500);
                
                // 전송 버튼 클릭
                const sendBtn = descContains("보내기").findOne(2000) ||
                               text("게시").findOne(2000);
                
                if (sendBtn) {
                    sendBtn.click();
                    log('댓글 작성 완료', 'success');
                    return true;
                }
            }
        }
    } catch (e) {
        log('댓글 작성 실패: ' + e.message, 'error');
    }
    
    // 좌표 기반 시도
    try {
        tap(CONFIG.UI_POSITIONS.comment.x, CONFIG.UI_POSITIONS.comment.y, '댓글 영역');
        sleep(1000);
        
        tap(CONFIG.UI_POSITIONS.commentInput.x, CONFIG.UI_POSITIONS.commentInput.y, '댓글 입력창');
        sleep(500);
        
        setText(commentText);
        sleep(500);
        
        tap(CONFIG.UI_POSITIONS.commentSend.x, CONFIG.UI_POSITIONS.commentSend.y, '댓글 전송');
        log('댓글 작성 완료 (좌표)', 'success');
        return true;
    } catch (e) {
        log('댓글 작성 실패 (좌표): ' + e.message, 'error');
        return false;
    }
}

/**
 * 구독하기
 */
function subscribeChannel() {
    log('채널 구독...');
    
    try {
        // 구독 버튼 찾기
        const subBtn = text("구독").findOne(3000);
        
        if (subBtn) {
            // 이미 구독 중인지 확인
            const parent = subBtn.parent();
            if (parent && parent.desc() && parent.desc().includes("구독중")) {
                log('이미 구독 중');
                return true;
            }
            
            subBtn.click();
            sleep(CONFIG.ACTION_DELAY);
            log('구독 완료', 'success');
            return true;
        }
    } catch (e) {
        // 좌표 기반 시도
    }
    
    tap(CONFIG.UI_POSITIONS.subscribe.x, CONFIG.UI_POSITIONS.subscribe.y, '구독');
    log('구독 완료 (좌표)', 'success');
    return true;
}

// ============================================================
// 메인
// ============================================================

function main() {
    log('═══════════════════════════════════════', 'info');
    log('DoAi.ME YouTube Agent v2.0', 'success');
    log('═══════════════════════════════════════', 'info');
    
    // 파라미터 파싱
    const params = parseParams();
    log(`파라미터: ${JSON.stringify(params, null, 2)}`);
    
    // 결과 객체
    const result = {
        success: false,
        videoId: params.videoId,
        watchedSeconds: 0,
        liked: false,
        commented: false,
        subscribed: false,
        isLoggedIn: false,
        error: null,
    };
    
    try {
        // 접근성 서비스 확인
        if (!auto.service) {
            log('접근성 서비스가 필요합니다', 'error');
            app.startActivity({
                action: 'android.settings.ACCESSIBILITY_SETTINGS'
            });
            result.error = '접근성 서비스 필요';
            return result;
        }
        
        // YouTube 앱 열기
        if (!openYouTube()) {
            result.error = 'YouTube 앱 실행 실패';
            return result;
        }
        
        // 로그인 상태 확인
        result.isLoggedIn = checkLoginStatus();
        
        // 로그인 필수인데 로그인 안 됨
        if (params.requireLogin && !result.isLoggedIn) {
            log('로그인이 필요한 작업입니다', 'error');
            result.error = '로그인 필요';
            return result;
        }
        
        // 영상 열기
        if (params.videoUrl) {
            if (!openVideoByUrl(params.videoUrl)) {
                result.error = '영상 열기 실패';
                return result;
            }
        } else {
            log('영상 URL 없음, 홈 화면에서 시작');
            // 홈에서 첫 번째 영상 탭
            sleep(2000);
            tap(0.5, 0.35, '첫 번째 영상');
            sleep(CONFIG.VIDEO_LOAD_DELAY);
        }
        
        // 광고 스킵
        if (params.skipAds) {
            skipAdsIfPresent();
        }
        
        // 시청 시간 계산
        const watchTime = randomBetween(params.minWatchSeconds, params.maxWatchSeconds);
        
        // 영상 시청
        watchVideo(watchTime);
        result.watchedSeconds = watchTime;
        
        // 좋아요 (로그인 무관)
        if (params.like) {
            result.liked = likeVideo();
        }
        
        // 댓글 (로그인 필요)
        if (params.comment && result.isLoggedIn) {
            result.commented = writeComment(params.comment);
        } else if (params.comment && !result.isLoggedIn) {
            log('댓글은 로그인 후 가능합니다', 'warn');
        }
        
        // 구독 (로그인 필요)
        if (params.subscribe && result.isLoggedIn) {
            result.subscribed = subscribeChannel();
        } else if (params.subscribe && !result.isLoggedIn) {
            log('구독은 로그인 후 가능합니다', 'warn');
        }
        
        result.success = true;
        log('═══════════════════════════════════════', 'info');
        log('작업 완료!', 'success');
        log('═══════════════════════════════════════', 'info');
        
    } catch (error) {
        result.error = error.message;
        log(`오류 발생: ${error.message}`, 'error');
    }
    
    return result;
}

// ============================================================
// 실행
// ============================================================

try {
    const result = main();
    log(`결과: ${JSON.stringify(result, null, 2)}`);
    
    // 결과 반환 (Laixi/Gateway가 수집)
    if (typeof $result !== 'undefined') {
        $result.set(result);
    }
    
    // engines 결과 설정
    if (typeof engines !== 'undefined') {
        engines.myEngine().setTag('result', JSON.stringify(result));
    }
    
} catch (error) {
    const errorResult = {
        success: false,
        error: error.message,
        stack: error.stack,
    };
    
    log(`치명적 오류: ${error.message}`, 'error');
    
    if (typeof $result !== 'undefined') {
        $result.set(errorResult);
    }
}
