/**
 * Somatic Engine (신체 엔진) - YouTube 자동화 행동 로직
 * 
 * 오리온 지시: "기계적인 1.0초 대기는 금지다"
 * 
 * 주요 기능:
 * 1. Configurable Watcher: 시청 시간 + 랜덤 스킵 (Double Tap)
 * 2. Search Navigator: 검색 → 텍스트 입력 → Top N 랜덤 클릭
 * 3. Human Touch: 모든 딜레이에 random(min, max) 적용
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const LaixiAdapter = require('./LaixiAdapter');

/**
 * YouTube 앱 좌표 맵 (Samsung Galaxy S9+ 기준, 비율 0.0~1.0)
 * 
 * 해상도: 1440 x 2960
 * 실제 좌표는 Laixi가 비율로 처리
 */
const YOUTUBE_COORDS = {
    // 상단 네비게이션
    SEARCH_ICON: { x: 0.85, y: 0.05 },          // 검색 아이콘 (우측 상단)
    SEARCH_INPUT: { x: 0.5, y: 0.05 },          // 검색 입력창
    SEARCH_CLEAR: { x: 0.9, y: 0.05 },          // 검색창 클리어 버튼
    
    // 검색 결과 리스트 (Top 1~5)
    RESULT_1: { x: 0.5, y: 0.25 },              // 첫 번째 결과
    RESULT_2: { x: 0.5, y: 0.45 },              // 두 번째 결과
    RESULT_3: { x: 0.5, y: 0.65 },              // 세 번째 결과
    RESULT_4: { x: 0.5, y: 0.85 },              // 네 번째 결과 (스크롤 필요할 수 있음)
    
    // 영상 플레이어 영역
    PLAYER_CENTER: { x: 0.5, y: 0.18 },         // 플레이어 중앙 (재생/일시정지)
    PLAYER_LEFT: { x: 0.2, y: 0.18 },           // 플레이어 좌측 (10초 뒤로)
    PLAYER_RIGHT: { x: 0.8, y: 0.18 },          // 플레이어 우측 (10초 앞으로)
    
    // 인터랙션 버튼
    LIKE_BUTTON: { x: 0.15, y: 0.35 },          // 좋아요 버튼
    DISLIKE_BUTTON: { x: 0.30, y: 0.35 },       // 싫어요 버튼
    COMMENT_SECTION: { x: 0.5, y: 0.80 },       // 댓글 섹션
    COMMENT_INPUT: { x: 0.5, y: 0.95 },         // 댓글 입력창
    
    // 스와이프 영역
    SCROLL_START: { x: 0.5, y: 0.7 },           // 스크롤 시작점
    SCROLL_END: { x: 0.5, y: 0.3 }              // 스크롤 종료점
};

/**
 * 기본 딜레이 설정 (모두 범위로 정의 - Human Touch)
 */
const DEFAULT_DELAYS = {
    // 짧은 액션 간 딜레이
    MICRO: { min: 50, max: 150 },               // 50~150ms
    SHORT: { min: 200, max: 500 },              // 200~500ms
    MEDIUM: { min: 800, max: 1500 },            // 800~1500ms
    LONG: { min: 2000, max: 4000 },             // 2~4초
    
    // 특정 액션별 딜레이
    AFTER_TAP: { min: 100, max: 300 },          // 탭 후
    AFTER_SEARCH: { min: 1500, max: 3000 },     // 검색 후 (결과 로딩)
    AFTER_SCROLL: { min: 500, max: 1000 },      // 스크롤 후
    BEFORE_TYPE: { min: 300, max: 700 },        // 타이핑 전
    BETWEEN_CHARS: { min: 30, max: 100 },       // 글자 간
    SEEK_INTERVAL: { min: 3000, max: 8000 },    // 스킵 간격 (3~8초)
    VIDEO_LOAD: { min: 2000, max: 5000 }        // 영상 로딩
};

/**
 * CONFIG 기본값 (API 스키마 참조)
 */
const DEFAULT_CONFIG = {
    // 검색 설정
    MAX_SCROLL_PAGES: {
        KEYWORD: 3,
        RECENT: 3,
        TITLE: 1
    },
    
    // 시청 설정
    WATCH_PERCENT_MIN: 40,
    WATCH_PERCENT_MAX: 100,
    SEEK_COUNT_MIN: 5,
    SEEK_COUNT_MAX: 20,
    
    // 인터랙션 확률
    COMMENT_RATE_MIN: 0.10,
    COMMENT_RATE_MAX: 0.50,
    LIKE_RATE_MIN: 0.20,
    LIKE_RATE_MAX: 0.70,
    
    // 탐색 중 랜덤 시청
    RANDOM_WATCH_RATE: 0.05,
    RANDOM_WATCH_TIME_MIN: 5,
    RANDOM_WATCH_TIME_MAX: 60
};

class SomaticEngine {
    /**
     * @param {LaixiAdapter} adapter - Laixi 어댑터 인스턴스
     * @param {Object} config - 설정 (DEFAULT_CONFIG 참조)
     */
    constructor(adapter, config = {}) {
        if (!adapter || !(adapter instanceof LaixiAdapter)) {
            throw new Error('유효한 LaixiAdapter 인스턴스 필요');
        }
        
        this.adapter = adapter;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.delays = { ...DEFAULT_DELAYS, ...(config.delays || {}) };
        this.coords = { ...YOUTUBE_COORDS, ...(config.coords || {}) };
        
        // 통계
        this._stats = {
            videosWatched: 0,
            totalWatchTime: 0,
            totalSeeks: 0,
            searchesPerformed: 0,
            tapCount: 0
        };
    }
    
    /**
     * 통계 조회
     */
    get stats() {
        return { ...this._stats };
    }
    
    // ==================== Human Touch: 랜덤 딜레이 ====================
    
    /**
     * 랜덤 정수 생성 (min ~ max)
     * 
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @returns {number}
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * 랜덤 소수 생성 (min ~ max)
     * 
     * @param {number} min - 최소값
     * @param {number} max - 최대값
     * @returns {number}
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    /**
     * Human Delay - 랜덤 대기
     * 기계적인 1.0초 대기 금지! 항상 범위 내에서 랜덤 선택
     * 
     * @param {Object|string} delay - { min, max } 또는 딜레이 키 이름
     * @returns {Promise<void>}
     */
    async humanDelay(delay) {
        let min, max;
        
        if (typeof delay === 'string') {
            // 딜레이 키로 조회
            const config = this.delays[delay];
            if (!config) {
                throw new Error(`알 수 없는 딜레이 키: ${delay}`);
            }
            min = config.min;
            max = config.max;
        } else if (typeof delay === 'object') {
            min = delay.min;
            max = delay.max;
        } else {
            throw new Error('딜레이는 객체 또는 문자열이어야 함');
        }
        
        const actualDelay = this.randomInt(min, max);
        await new Promise(resolve => setTimeout(resolve, actualDelay));
        
        return actualDelay;
    }
    
    /**
     * 좌표에 약간의 랜덤 오프셋 추가 (Human Touch)
     * 
     * @param {Object} coord - { x, y }
     * @param {number} jitter - 오프셋 범위 (기본 0.02 = 2%)
     * @returns {Object}
     */
    jitterCoord(coord, jitter = 0.02) {
        return {
            x: Math.max(0, Math.min(1, coord.x + this.randomFloat(-jitter, jitter))),
            y: Math.max(0, Math.min(1, coord.y + this.randomFloat(-jitter, jitter)))
        };
    }
    
    // ==================== Configurable Watcher ====================
    
    /**
     * 영상 시청 + 랜덤 스킵 (Double Tap)
     * 
     * 오리온 지시: "단순히 play()가 아니라, 입력받은 watch_time만큼 기다리고,
     *             중간중간 seek_count만큼 랜덤하게 스킵(Double Tap)하는 함수를 짜라"
     * 
     * @param {string} deviceIds - 대상 디바이스 (또는 'all')
     * @param {number} watchTimeSec - 총 시청 시간 (초)
     * @param {number} seekCount - 스킵 횟수 (null이면 config에서 랜덤)
     * @returns {Promise<Object>} - { actualWatchTime, seeksDone, interrupted }
     */
    async watchVideo(deviceIds, watchTimeSec, seekCount = null) {
        // seekCount가 없으면 config에서 랜덤 결정
        const finalSeekCount = seekCount ?? this.randomInt(
            this.config.SEEK_COUNT_MIN,
            this.config.SEEK_COUNT_MAX
        );
        
        this._logInfo(`📺 시청 시작: ${watchTimeSec}초, 스킵: ${finalSeekCount}회`);
        
        const startTime = Date.now();
        const watchTimeMs = watchTimeSec * 1000;
        
        // 스킵 시점 계산: 시청 시간을 랜덤하게 분할
        const seekTimes = this._generateSeekTimes(watchTimeMs, finalSeekCount);
        
        let seeksDone = 0;
        let nextSeekIndex = 0;
        
        // 시청 시작 - 플레이어 탭으로 재생 확인
        await this._tapWithHumanTouch(deviceIds, this.coords.PLAYER_CENTER);
        await this.humanDelay('VIDEO_LOAD');
        
        // 메인 시청 루프
        while (true) {
            const elapsed = Date.now() - startTime;
            
            // 시청 완료 체크
            if (elapsed >= watchTimeMs) {
                break;
            }
            
            // 다음 스킵 시점 도달 체크
            if (nextSeekIndex < seekTimes.length && elapsed >= seekTimes[nextSeekIndex]) {
                await this._doubleTapSeek(deviceIds);
                seeksDone++;
                nextSeekIndex++;
                
                this._logInfo(`⏩ 스킵 ${seeksDone}/${finalSeekCount} (${Math.round(elapsed / 1000)}초 경과)`);
            }
            
            // 짧은 대기 (폴링)
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const actualWatchTime = Math.round((Date.now() - startTime) / 1000);
        
        // 통계 업데이트
        this._stats.videosWatched++;
        this._stats.totalWatchTime += actualWatchTime;
        this._stats.totalSeeks += seeksDone;
        
        this._logInfo(`✅ 시청 완료: ${actualWatchTime}초, 스킵: ${seeksDone}회`);
        
        return {
            actualWatchTime,
            seeksDone,
            interrupted: false
        };
    }
    
    /**
     * 스킵 시점 배열 생성 (랜덤 분포)
     * 
     * @param {number} totalMs - 총 시청 시간 (ms)
     * @param {number} count - 스킵 횟수
     * @returns {number[]} - 스킵 시점 배열 (ms)
     */
    _generateSeekTimes(totalMs, count) {
        if (count <= 0 || totalMs <= 0) return [];
        
        const times = [];
        const minInterval = this.delays.SEEK_INTERVAL.min;
        const maxInterval = this.delays.SEEK_INTERVAL.max;
        
        // 첫 스킵은 최소 3초 후
        let currentTime = this.randomInt(3000, Math.min(8000, totalMs / 4));
        
        for (let i = 0; i < count && currentTime < totalMs - 2000; i++) {
            times.push(currentTime);
            currentTime += this.randomInt(minInterval, maxInterval);
        }
        
        return times.sort((a, b) => a - b);
    }
    
    /**
     * Double Tap으로 앞으로 스킵 (10초 점프)
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async _doubleTapSeek(deviceIds) {
        const coord = this.jitterCoord(this.coords.PLAYER_RIGHT);
        
        // Double Tap: 두 번 빠르게 탭
        await this.adapter.tap(deviceIds, coord.x, coord.y);
        await this.humanDelay('MICRO');
        await this.adapter.tap(deviceIds, coord.x, coord.y);
        
        await this.humanDelay('AFTER_TAP');
    }
    
    // ==================== Search Navigator ====================
    
    /**
     * 유튜브 검색 → 결과에서 랜덤 선택
     * 
     * 오리온 지시: "유튜브 앱 상단의 '검색 아이콘' 좌표를 찾고 → 텍스트 입력 →
     *             결과 리스트에서 랜덤하게(Top 3 중 하나) 클릭하는 로직"
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} keyword - 검색 키워드
     * @param {number} maxRank - 선택 범위 (기본 3 = Top 3 중 랜덤)
     * @returns {Promise<Object>} - { selectedRank, keyword }
     */
    async searchAndSelect(deviceIds, keyword, maxRank = 3) {
        this._logInfo(`🔍 검색 시작: "${keyword}" (Top ${maxRank}에서 선택)`);
        
        // 1. 검색 아이콘 탭
        await this._tapWithHumanTouch(deviceIds, this.coords.SEARCH_ICON);
        await this.humanDelay('MEDIUM');
        
        // 2. 검색창 탭 (포커스)
        await this._tapWithHumanTouch(deviceIds, this.coords.SEARCH_INPUT);
        await this.humanDelay('BEFORE_TYPE');
        
        // 3. 키워드 입력 (Human Touch: 글자 간 랜덤 딜레이)
        await this._typeTextHuman(deviceIds, keyword);
        await this.humanDelay('SHORT');
        
        // 4. 검색 실행 (Enter 키)
        await this.adapter.executeAdb(deviceIds, 'input keyevent 66'); // KEYCODE_ENTER
        await this.humanDelay('AFTER_SEARCH');
        
        // 5. 검색 결과에서 랜덤 선택 (Top N)
        const selectedRank = this.randomInt(1, Math.min(maxRank, 4));
        const resultCoord = this._getResultCoord(selectedRank);
        
        this._logInfo(`📍 결과 ${selectedRank}번 선택`);
        
        await this._tapWithHumanTouch(deviceIds, resultCoord);
        await this.humanDelay('VIDEO_LOAD');
        
        // 통계 업데이트
        this._stats.searchesPerformed++;
        
        return {
            selectedRank,
            keyword
        };
    }
    
    /**
     * 검색 결과 순위별 좌표 반환
     * 
     * @param {number} rank - 순위 (1~4)
     * @returns {Object} - { x, y }
     */
    _getResultCoord(rank) {
        const coordMap = {
            1: this.coords.RESULT_1,
            2: this.coords.RESULT_2,
            3: this.coords.RESULT_3,
            4: this.coords.RESULT_4
        };
        
        return coordMap[rank] || this.coords.RESULT_1;
    }
    
    /**
     * Human Touch 텍스트 입력 (글자 간 랜덤 딜레이)
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} text - 입력할 텍스트
     */
    /**
     * Human Touch 텍스트 입력 (글자 간 랜덤 딜레이)
     * 
     * ADB command injection 방지를 위해:
     * - 한글 또는 특수문자가 포함된 경우 클립보드 방식 사용
     * - 영숫자만 있는 경우에도 안전한 escaping 적용
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} text - 입력할 텍스트
     */
    async _typeTextHuman(deviceIds, text) {
        // ADB command injection 위험 문자: ", `, $, \, %, ', 공백, 한글 등
        // 참고: 문자 클래스 [] 내에서 |는 리터럴이므로 제거
        const unsafePattern = /[ㄱ-ㅎㅏ-ㅣ가-힣"'`$\\%\s]/;
        
        // 한글이나 특수문자가 있으면 클립보드 방식 사용 (가장 안전)
        if (unsafePattern.test(text)) {
            // 클립보드에 텍스트 복사
            await this.adapter.sendCommand({
                action: 'writeclipboard',
                comm: {
                    deviceIds: deviceIds,
                    content: text
                }
            });
            await this.humanDelay('SHORT');
            
            // 붙여넣기 (Ctrl+V)
            await this.adapter.executeAdb(deviceIds, 'input keyevent 279'); // KEYCODE_PASTE
        } else {
            // 영숫자만 있는 경우: 안전한 문자만 허용 (추가 검증)
            if (!/^[A-Za-z0-9._\-]+$/.test(text)) {
                // 예기치 않은 문자가 있으면 클립보드 방식으로 fallback
                await this.adapter.sendCommand({
                    action: 'writeclipboard',
                    comm: {
                        deviceIds: deviceIds,
                        content: text
                    }
                });
                await this.humanDelay('SHORT');
                await this.adapter.executeAdb(deviceIds, 'input keyevent 279');
            } else {
                // 완전히 안전한 영숫자만 직접 입력
                await this.adapter.executeAdb(deviceIds, `input text "${text}"`);
            }
        }
        
        await this.humanDelay('AFTER_TAP');
    }
    
    // ==================== 공통 유틸리티 ====================
    
    /**
     * Human Touch가 적용된 탭
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {Object} coord - { x, y }
     */
    async _tapWithHumanTouch(deviceIds, coord) {
        const jitteredCoord = this.jitterCoord(coord);
        
        await this.adapter.tap(deviceIds, jitteredCoord.x, jitteredCoord.y);
        this._stats.tapCount++;
        
        await this.humanDelay('AFTER_TAP');
    }
    
    /**
     * 스크롤 다운 (Human Touch 적용)
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async scrollDown(deviceIds) {
        await this.adapter.swipe(deviceIds, 'up');
        await this.humanDelay('AFTER_SCROLL');
    }
    
    /**
     * 스크롤 업 (Human Touch 적용)
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async scrollUp(deviceIds) {
        await this.adapter.swipe(deviceIds, 'down');
        await this.humanDelay('AFTER_SCROLL');
    }
    
    /**
     * 좋아요 누르기
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async pressLike(deviceIds) {
        await this._tapWithHumanTouch(deviceIds, this.coords.LIKE_BUTTON);
        this._logInfo('👍 좋아요 완료');
    }
    
    /**
     * 댓글 작성
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {string} comment - 댓글 내용
     */
    async writeComment(deviceIds, comment) {
        // 1. 댓글 섹션으로 스크롤
        await this.scrollDown(deviceIds);
        await this.humanDelay('MEDIUM');
        
        // 2. 댓글 입력창 탭
        await this._tapWithHumanTouch(deviceIds, this.coords.COMMENT_INPUT);
        await this.humanDelay('BEFORE_TYPE');
        
        // 3. 댓글 입력
        await this._typeTextHuman(deviceIds, comment);
        await this.humanDelay('SHORT');
        
        // 4. 전송 (우측 상단 전송 버튼 또는 Enter)
        await this.adapter.executeAdb(deviceIds, 'input keyevent 66'); // KEYCODE_ENTER
        
        this._logInfo(`💬 댓글 작성 완료: "${comment.substring(0, 20)}..."`);
    }
    
    /**
     * 홈으로 이동
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async goHome(deviceIds) {
        await this.adapter.pressHome(deviceIds);
        await this.humanDelay('LONG');
    }
    
    /**
     * 뒤로 가기
     * 
     * @param {string} deviceIds - 대상 디바이스
     */
    async goBack(deviceIds) {
        await this.adapter.pressBack(deviceIds);
        await this.humanDelay('MEDIUM');
    }
    
    // ==================== 복합 시나리오 ====================
    
    /**
     * 전체 시청 시나리오 실행
     * 
     * @param {string} deviceIds - 대상 디바이스
     * @param {Object} task - 작업 정보 (keyword, watchTime, doLike, doComment, commentText)
     * @returns {Promise<Object>} - 결과
     */
    async executeWatchScenario(deviceIds, task) {
        const {
            keyword,
            watchTime = 60,
            seekCount = null,
            doLike = false,
            doComment = false,
            commentText = ''
        } = task;
        
        this._logInfo('🎬 시나리오 시작');
        
        const result = {
            keyword,
            searchRank: 0,
            watchTime: 0,
            seeksDone: 0,
            liked: false,
            commented: false,
            commentText: '',
            status: 'pending'
        };
        
        try {
            // 1. 검색 및 영상 선택
            const searchResult = await this.searchAndSelect(deviceIds, keyword);
            result.searchRank = searchResult.selectedRank;
            
            // 2. 영상 시청
            const watchResult = await this.watchVideo(deviceIds, watchTime, seekCount);
            result.watchTime = watchResult.actualWatchTime;
            result.seeksDone = watchResult.seeksDone;
            
            // 3. 좋아요 (조건부)
            if (doLike && this._shouldDoAction(this.config.LIKE_RATE_MIN, this.config.LIKE_RATE_MAX)) {
                await this.pressLike(deviceIds);
                result.liked = true;
            }
            
            // 4. 댓글 (조건부)
            if (doComment && commentText && this._shouldDoAction(this.config.COMMENT_RATE_MIN, this.config.COMMENT_RATE_MAX)) {
                await this.writeComment(deviceIds, commentText);
                result.commented = true;
                result.commentText = commentText;
            }
            
            // 5. 뒤로 나가기
            await this.goBack(deviceIds);
            
            result.status = 'completed';
            this._logInfo('✅ 시나리오 완료');
            
        } catch (err) {
            result.status = 'error';
            result.error = err.message;
            this._logError('시나리오 실패', err);
        }
        
        return result;
    }
    
    /**
     * 확률 기반 액션 결정
     * 
     * @param {number} minRate - 최소 확률
     * @param {number} maxRate - 최대 확률
     * @returns {boolean}
     */
    _shouldDoAction(minRate, maxRate) {
        const rate = this.randomFloat(minRate, maxRate);
        return Math.random() < rate;
    }
    
    // ==================== 로깅 ====================
    
    _logInfo(message) {
        const timestamp = new Date().toISOString();
        console.log(`\x1b[36m${timestamp}\x1b[0m \x1b[34m[SOMATIC]\x1b[0m ${message}`);
    }
    
    _logError(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`\x1b[36m${timestamp}\x1b[0m \x1b[31m[SOMATIC ERROR]\x1b[0m ${message}`, error?.message || '');
    }
}

module.exports = {
    SomaticEngine,
    YOUTUBE_COORDS,
    DEFAULT_DELAYS,
    DEFAULT_CONFIG,
};


