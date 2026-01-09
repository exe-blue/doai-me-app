/**
 * YouTubeController.js
 * 
 * YouTube 자동화를 위한 고수준 컨트롤러
 * LaixiAdapter와 SomaticEngine을 활용하여 YouTube 앱 제어
 * 
 * @author Axon (DoAi.Me Tech Lead)
 * @created 2026-01-01
 */

const { SomaticEngine } = require('./SomaticEngine');
const { createLogger } = require('./logger');

const logger = createLogger('YouTubeController');

/**
 * 검색 경로 유형 (4단계 Fallback)
 */
const SEARCH_TYPE = {
  KEYWORD: 1,       // 키워드 검색
  KEYWORD_RECENT: 2, // 키워드 + 최근 필터
  TITLE: 3,         // 제목 검색
  DIRECT_URL: 4,    // URL 직접 열기
};

/**
 * YouTube 앱 UI 좌표 (1080x1920 기준)
 */
const UI_COORDS = {
  SEARCH_ICON: { x: 946, y: 100 },
  SEARCH_INPUT: { x: 540, y: 160 },
  FIRST_RESULT: { x: 540, y: 400 },
  FILTER_BUTTON: { x: 946, y: 260 },
  FILTER_RECENT: { x: 540, y: 520 },
  LIKE_BUTTON: { x: 116, y: 1330 },
  COMMENT_BUTTON: { x: 312, y: 1330 },
  COMMENT_INPUT: { x: 540, y: 1800 },
  COMMENT_SEND: { x: 1000, y: 1800 },
  PLAYER_CENTER: { x: 540, y: 540 },
  SEEK_RIGHT: { x: 810, y: 540 },
  SEEK_LEFT: { x: 270, y: 540 },
};

/**
 * CONFIG 설정
 */
const CONFIG = {
  WATCH: {
    MIN_RATIO: 0.4,
    MAX_RATIO: 1.0,
    ACTION_INTERVAL_MIN: 15000,
    ACTION_INTERVAL_MAX: 45000,
  },
  DELAYS: {
    TYPE: { min: 500, max: 1500 },
    SCROLL: { min: 1000, max: 3000 },
    ACTION: { min: 2000, max: 5000 },
    SEARCH: { min: 3000, max: 7000 },
    LOAD: { min: 2000, max: 4000 },
  },
  MAX_SCROLL_PAGES: {
    KEYWORD: 3,
    RECENT: 3,
    TITLE: 1,
  },
  POST_WATCH: {
    LIKE_RATE: { min: 0.5, max: 0.8 },
    COMMENT_RATE: { min: 0.3, max: 0.5 },
    COMMENT_LIKE_RATE: { min: 0.2, max: 0.3 },
  },
  COMMENTS: [
    '좋은 영상이네요 👍',
    '잘 봤습니다!',
    '유익한 정보 감사합니다',
    '응원합니다!',
    '오늘도 좋은 하루 되세요~',
    '최고예요!',
    'Great content!',
  ],
};

/**
 * YouTubeController 클래스
 */
export class YouTubeController {
  /**
   * @param {LaixiAdapter} adapter - Laixi WebSocket 어댑터
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.somaticEngine = new SomaticEngine(adapter);
    this.isRunning = false;
  }

  /**
   * YouTube 앱 실행
   * @param {string|number} deviceId - 디바이스 ID
   */
  async launchYouTube(deviceId) {
    logger.info(`[${deviceId}] YouTube 앱 실행`);
    await this.adapter.openApp(deviceId, 'youtube');
    await this.somaticEngine.humanDelay('LOAD');
  }

  /**
   * 검색 화면으로 이동
   * @param {string|number} deviceId - 디바이스 ID
   */
  async goToSearch(deviceId) {
    logger.info(`[${deviceId}] 검색 화면 이동`);
    await this.adapter.tap(deviceId, UI_COORDS.SEARCH_ICON.x, UI_COORDS.SEARCH_ICON.y);
    await this.somaticEngine.humanDelay('ACTION');
  }

  /**
   * 검색어 입력 (한글 지원)
   * @param {string|number} deviceId - 디바이스 ID
   * @param {string} query - 검색어
   */
  async inputSearchQuery(deviceId, query) {
    logger.info(`[${deviceId}] 검색어 입력: ${query}`);
    
    // 한글 여부 확인
    const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(query);
    
    if (hasKorean) {
      // 한글: 클립보드 방식 사용
      await this.adapter.setClipboard(deviceId, query);
      await this.somaticEngine.humanDelay('SHORT');
      await this.adapter.paste(deviceId);
    } else {
      // 영어: 직접 입력
      await this.adapter.inputText(deviceId, query);
    }
    
    await this.somaticEngine.humanDelay('TYPE');
    await this.adapter.sendKey(deviceId, 66); // Enter키
    await this.somaticEngine.humanDelay('SEARCH');
  }

  /**
   * 시간 필터 적용 (최근 1시간)
   * @param {string|number} deviceId - 디바이스 ID
   */
  async applyTimeFilter(deviceId) {
    logger.info(`[${deviceId}] 최근 1시간 필터 적용`);
    
    // 필터 버튼 클릭
    await this.adapter.tap(deviceId, UI_COORDS.FILTER_BUTTON.x, UI_COORDS.FILTER_BUTTON.y);
    await this.somaticEngine.humanDelay('ACTION');
    
    // 최근 옵션 선택
    await this.adapter.tap(deviceId, UI_COORDS.FILTER_RECENT.x, UI_COORDS.FILTER_RECENT.y);
    await this.somaticEngine.humanDelay('LOAD');
  }

  /**
   * 제목으로 영상 찾기 (스크롤)
   * @param {string|number} deviceId - 디바이스 ID
   * @param {string} title - 찾을 영상 제목
   * @param {number} maxScrolls - 최대 스크롤 횟수
   * @returns {Object|null} 찾은 영상 정보 또는 null
   */
  async findVideoByTitle(deviceId, title, maxScrolls = 3) {
    logger.info(`[${deviceId}] 영상 검색: "${title}" (최대 ${maxScrolls}회 스크롤)`);
    
    for (let i = 0; i < maxScrolls; i++) {
      // 현재 화면 분석 (실제로는 OCR이나 UI 트리 분석 필요)
      // 여기서는 스크롤만 수행
      await this.somaticEngine.humanDelay('SCROLL');
      
      // 스와이프하여 다음 결과 보기
      await this.adapter.swipeCoords(deviceId, 540, 1400, 540, 400, 500);
      await this.somaticEngine.humanDelay('LOAD');
    }
    
    // 첫 번째 결과 클릭 (간략화된 로직)
    await this.adapter.tap(deviceId, UI_COORDS.FIRST_RESULT.x, UI_COORDS.FIRST_RESULT.y);
    return { found: true, rank: 1 };
  }

  /**
   * URL로 영상 직접 열기
   * @param {string|number} deviceId - 디바이스 ID
   * @param {string} url - YouTube URL
   */
  async openVideoByUrl(deviceId, url) {
    logger.info(`[${deviceId}] URL로 영상 열기: ${url}`);
    
    // YouTube 딥링크 또는 브라우저로 열기
    const videoId = this._extractVideoId(url);
    if (videoId) {
      const deepLink = `vnd.youtube:${videoId}`;
      await this.adapter.openUrl(deviceId, deepLink);
    } else {
      await this.adapter.openUrl(deviceId, url);
    }
    
    await this.somaticEngine.humanDelay('LOAD');
  }

  /**
   * URL에서 비디오 ID 추출
   * @private
   */
  _extractVideoId(url) {
    const patterns = [
      /[?&]v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /\/embed\/([^?]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * 4단계 Fallback 검색 프로세스
   * @param {string|number} deviceId - 디바이스 ID
   * @param {Object} task - 작업 정보 { keyword, title, url }
   * @returns {Object} 검색 결과 { searchType, rank, found }
   */
  async searchVideo(deviceId, task) {
    const { keyword, title, url } = task;
    
    // 1단계: 키워드 검색
    if (keyword) {
      logger.info(`[${deviceId}] 1단계: 키워드 검색 "${keyword}"`);
      await this.goToSearch(deviceId);
      await this.inputSearchQuery(deviceId, keyword);
      
      const result = await this.findVideoByTitle(deviceId, title, CONFIG.MAX_SCROLL_PAGES.KEYWORD);
      if (result.found) {
        return { searchType: SEARCH_TYPE.KEYWORD, rank: result.rank, found: true };
      }
    }
    
    // 2단계: 키워드 + 최근 필터
    if (keyword) {
      logger.info(`[${deviceId}] 2단계: 키워드 + 최근 필터`);
      await this.adapter.sendKey(deviceId, 4); // Back
      await this.somaticEngine.humanDelay('ACTION');
      await this.goToSearch(deviceId);
      await this.inputSearchQuery(deviceId, keyword);
      await this.applyTimeFilter(deviceId);
      
      const result = await this.findVideoByTitle(deviceId, title, CONFIG.MAX_SCROLL_PAGES.RECENT);
      if (result.found) {
        return { searchType: SEARCH_TYPE.KEYWORD_RECENT, rank: result.rank, found: true };
      }
    }
    
    // 3단계: 제목 검색
    if (title) {
      logger.info(`[${deviceId}] 3단계: 제목 검색 "${title}"`);
      await this.adapter.sendKey(deviceId, 4); // Back
      await this.somaticEngine.humanDelay('ACTION');
      await this.goToSearch(deviceId);
      await this.inputSearchQuery(deviceId, title);
      
      const result = await this.findVideoByTitle(deviceId, title, CONFIG.MAX_SCROLL_PAGES.TITLE);
      if (result.found) {
        return { searchType: SEARCH_TYPE.TITLE, rank: result.rank, found: true };
      }
    }
    
    // 4단계: URL 직접 열기
    if (url) {
      logger.info(`[${deviceId}] 4단계: URL 직접 열기`);
      await this.openVideoByUrl(deviceId, url);
      return { searchType: SEARCH_TYPE.DIRECT_URL, rank: 0, found: true };
    }
    
    return { searchType: 0, rank: 0, found: false };
  }

  /**
   * 영상 시청 (Human-like 행동 포함)
   * @param {string|number} deviceId - 디바이스 ID
   * @param {number} duration - 영상 길이(초)
   * @param {number} seekCount - 앞으로 가기 횟수
   * @returns {number} 실제 시청 시간(초)
   */
  async watchVideo(deviceId, duration, seekCount = 0) {
    // 시청 시간 계산 (40~100%)
    const ratio = this._randomRange(CONFIG.WATCH.MIN_RATIO, CONFIG.WATCH.MAX_RATIO);
    const watchTime = Math.floor(duration * ratio);
    
    logger.info(`[${deviceId}] 영상 시청 시작: ${watchTime}초 (${Math.floor(ratio * 100)}%)`);
    
    // Somatic Engine으로 시청 수행
    await this.somaticEngine.watchVideo([deviceId], watchTime, seekCount);
    
    return watchTime;
  }

  /**
   * 좋아요 클릭
   * @param {string|number} deviceId - 디바이스 ID
   * @returns {boolean} 성공 여부
   */
  async clickLike(deviceId) {
    const rate = this._randomRange(CONFIG.POST_WATCH.LIKE_RATE.min, CONFIG.POST_WATCH.LIKE_RATE.max);
    
    if (Math.random() < rate) {
      logger.info(`[${deviceId}] 좋아요 클릭`);
      await this.adapter.tap(deviceId, UI_COORDS.LIKE_BUTTON.x, UI_COORDS.LIKE_BUTTON.y);
      await this.somaticEngine.humanDelay('ACTION');
      return true;
    }
    return false;
  }

  /**
   * 댓글 작성
   * @param {string|number} deviceId - 디바이스 ID
   * @param {string} [customComment] - 사용자 지정 댓글 (없으면 랜덤)
   * @returns {Object} { commented: boolean, text: string }
   */
  async writeComment(deviceId, customComment) {
    const rate = this._randomRange(CONFIG.POST_WATCH.COMMENT_RATE.min, CONFIG.POST_WATCH.COMMENT_RATE.max);
    
    if (Math.random() < rate) {
      const comment = customComment || CONFIG.COMMENTS[Math.floor(Math.random() * CONFIG.COMMENTS.length)];
      
      logger.info(`[${deviceId}] 댓글 작성: ${comment}`);
      
      // 댓글 버튼 클릭
      await this.adapter.tap(deviceId, UI_COORDS.COMMENT_BUTTON.x, UI_COORDS.COMMENT_BUTTON.y);
      await this.somaticEngine.humanDelay('LOAD');
      
      // 댓글 입력창 클릭
      await this.adapter.tap(deviceId, UI_COORDS.COMMENT_INPUT.x, UI_COORDS.COMMENT_INPUT.y);
      await this.somaticEngine.humanDelay('SHORT');
      
      // 댓글 입력 (한글 지원)
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(comment);
      if (hasKorean) {
        await this.adapter.setClipboard(deviceId, comment);
        await this.somaticEngine.humanDelay('SHORT');
        await this.adapter.paste(deviceId);
      } else {
        await this.adapter.inputText(deviceId, comment);
      }
      
      await this.somaticEngine.humanDelay('TYPE');
      
      // 전송 버튼 클릭
      await this.adapter.tap(deviceId, UI_COORDS.COMMENT_SEND.x, UI_COORDS.COMMENT_SEND.y);
      await this.somaticEngine.humanDelay('ACTION');
      
      return { commented: true, text: comment };
    }
    
    return { commented: false, text: '' };
  }

  /**
   * 전체 작업 수행 (검색 → 시청 → 상호작용)
   * @param {string|number} deviceId - 디바이스 ID
   * @param {Object} task - 작업 정보
   * @returns {Object} 결과 데이터
   */
  async processTask(deviceId, task) {
    const startTime = Date.now();
    
    try {
      // 1. YouTube 앱 실행
      await this.launchYouTube(deviceId);
      
      // 2. 영상 검색
      const searchResult = await this.searchVideo(deviceId, task);
      if (!searchResult.found) {
        return {
          device_id: deviceId,
          video_id: task.id,
          status: 'not_found',
          search_type: 0,
          watch_time: 0,
        };
      }
      
      // 3. 영상 시청
      const duration = task.duration || 300; // 기본 5분
      const seekCount = Math.floor(this._randomRange(5, 15));
      const watchTime = await this.watchVideo(deviceId, duration, seekCount);
      
      // 4. 좋아요
      const liked = await this.clickLike(deviceId);
      
      // 5. 댓글
      const commentResult = await this.writeComment(deviceId, task.customComment);
      
      return {
        device_id: deviceId,
        video_id: task.id,
        title: task.title,
        watch_time: watchTime,
        total_duration: duration,
        commented: commentResult.commented,
        comment_text: commentResult.text,
        liked: liked,
        search_type: searchResult.searchType,
        search_rank: searchResult.rank,
        status: 'completed',
        timestamp: new Date().toISOString(),
        elapsed_ms: Date.now() - startTime,
      };
      
    } catch (error) {
      logger.error(`[${deviceId}] 작업 실패:`, error.message);
      return {
        device_id: deviceId,
        video_id: task.id,
        status: 'error',
        error_message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 범위 내 랜덤값 생성
   * @private
   */
  _randomRange(min, max) {
    return min + Math.random() * (max - min);
  }
}

module.exports = { YouTubeController, SEARCH_TYPE, CONFIG };

