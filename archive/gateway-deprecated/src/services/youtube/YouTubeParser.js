/**
 * YouTubeParser Service
 * YouTube URL 파싱 및 메타데이터 조회
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 2.1
 */

const logger = require('../../utils/logger');

// ============================================================================
// 상수 정의
// ============================================================================

// 유효한 YouTube 도메인
const YOUTUBE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'youtube-nocookie.com'
];

// Video ID 추출 패턴
const VIDEO_ID_PATTERNS = [
    /[?&]v=([A-Za-z0-9_-]{11})/,           // watch?v=
    /youtu\.be\/([A-Za-z0-9_-]{11})/,      // youtu.be/
    /embed\/([A-Za-z0-9_-]{11})/,          // embed/
    /\/v\/([A-Za-z0-9_-]{11})/,            // /v/
    /shorts\/([A-Za-z0-9_-]{11})/          // shorts/
];

// Video ID 형식 검증
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

// 에러 타입
const ParseError = {
    INVALID_URL: 'INVALID_URL',
    NO_VIDEO_ID: 'NO_VIDEO_ID',
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
    API_ERROR: 'API_ERROR',
    RATE_LIMITED: 'RATE_LIMITED'
};

// ============================================================================
// YouTubeParser 클래스
// ============================================================================

class YouTubeParser {
    /**
     * @param {Object} options - 설정 옵션
     * @param {string} options.apiKey - YouTube Data API v3 키 (선택)
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.YOUTUBE_API_KEY;
        this.useOEmbed = !this.apiKey; // API 키 없으면 oEmbed 사용
        
        if (this.useOEmbed) {
            logger.info('[YouTubeParser] No API key provided, using oEmbed fallback');
        }
    }

    // ========================================================================
    // URL 검증 및 Video ID 추출
    // ========================================================================

    /**
     * URL이 유효한 YouTube URL인지 확인
     * @param {string} url - 검증할 URL
     * @returns {boolean} 유효 여부
     */
    isValidYouTubeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            const domain = parsedUrl.hostname.replace('www.', '');
            return YOUTUBE_DOMAINS.some(d => domain.includes(d.replace('www.', '')));
        } catch {
            return false;
        }
    }

    /**
     * URL에서 Video ID 추출
     * @param {string} url - YouTube URL
     * @returns {string|null} Video ID 또는 null
     */
    extractVideoId(url) {
        for (const pattern of VIDEO_ID_PATTERNS) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Video ID 형식 검증
     * @param {string} videoId - Video ID
     * @returns {boolean} 유효 여부
     */
    isValidVideoId(videoId) {
        return VIDEO_ID_REGEX.test(videoId);
    }

    // ========================================================================
    // 메타데이터 조회
    // ========================================================================

    /**
     * YouTube Data API v3로 비디오 메타데이터 조회
     * @param {string} videoId - Video ID
     * @returns {Promise<Object>} 비디오 정보
     */
    async fetchViaDataApi(videoId) {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=snippet,contentDetails&id=${videoId}&key=${this.apiKey}`;

        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 403) {
                throw { code: ParseError.RATE_LIMITED, status: 403 };
            }
            throw { code: ParseError.API_ERROR, status: response.status };
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            throw { code: ParseError.VIDEO_NOT_FOUND, status: 404 };
        }

        const item = data.items[0];
        const duration = this.parseIsoDuration(item.contentDetails.duration);

        return {
            video_id: videoId,
            title: item.snippet.title,
            duration_seconds: duration,
            channel_name: item.snippet.channelTitle,
            channel_id: item.snippet.channelId,
            thumbnail_url: item.snippet.thumbnails?.medium?.url || 
                          item.snippet.thumbnails?.default?.url,
            published_at: item.snippet.publishedAt,
            description: item.snippet.description?.substring(0, 500) // 최대 500자
        };
    }

    /**
     * oEmbed API로 비디오 메타데이터 조회 (API 키 불필요)
     * @param {string} videoId - Video ID
     * @returns {Promise<Object>} 비디오 정보
     */
    async fetchViaOEmbed(videoId) {
        const oembedUrl = `https://www.youtube.com/oembed?` +
            `url=https://youtube.com/watch?v=${videoId}&format=json`;

        const response = await fetch(oembedUrl);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw { code: ParseError.VIDEO_NOT_FOUND, status: 404 };
            }
            throw { code: ParseError.API_ERROR, status: response.status };
        }

        const data = await response.json();

        return {
            video_id: videoId,
            title: data.title,
            duration_seconds: 0, // oEmbed는 duration 미제공
            channel_name: data.author_name,
            channel_url: data.author_url,
            thumbnail_url: data.thumbnail_url,
            // oEmbed 추가 정보
            html: data.html,
            width: data.width,
            height: data.height
        };
    }

    /**
     * noembed.com 프록시로 메타데이터 조회 (대체 방법)
     * @param {string} videoId - Video ID
     * @returns {Promise<Object>} 비디오 정보
     */
    async fetchViaNoembed(videoId) {
        const noembedUrl = `https://noembed.com/embed?` +
            `url=https://youtube.com/watch?v=${videoId}`;

        const response = await fetch(noembedUrl);

        if (!response.ok) {
            throw { code: ParseError.API_ERROR, status: response.status };
        }

        const data = await response.json();

        if (data.error) {
            throw { code: ParseError.VIDEO_NOT_FOUND, status: 404 };
        }

        return {
            video_id: videoId,
            title: data.title,
            duration_seconds: 0,
            channel_name: data.author_name,
            thumbnail_url: data.thumbnail_url
        };
    }

    /**
     * ISO 8601 duration 파싱 (PT1H2M3S -> 초)
     * @param {string} isoDuration - ISO 8601 형식 duration
     * @returns {number} 초 단위 duration
     */
    parseIsoDuration(isoDuration) {
        if (!isoDuration) return 0;

        const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);

        return hours * 3600 + minutes * 60 + seconds;
    }

    // ========================================================================
    // 메인 파싱 함수
    // ========================================================================

    /**
     * YouTube URL 파싱 및 메타데이터 조회
     * 
     * @param {string} url - YouTube URL
     * @returns {Promise<Object>} 파싱 결과
     * @returns {boolean} .success - 성공 여부
     * @returns {Object} [.data] - 비디오 정보 (성공 시)
     * @returns {string} [.error] - 에러 코드 (실패 시)
     * @returns {string} [.message] - 에러 메시지 (실패 시)
     */
    async parse(url) {
        logger.debug(`[YouTubeParser] Parsing URL: ${url}`);

        // Step 1: URL 형식 검증
        if (!this.isValidYouTubeUrl(url)) {
            logger.warn(`[YouTubeParser] Invalid URL format: ${url}`);
            return {
                success: false,
                error: ParseError.INVALID_URL,
                message: 'The provided URL is not a valid YouTube URL'
            };
        }

        // Step 2: Video ID 추출
        const videoId = this.extractVideoId(url);

        if (!videoId || !this.isValidVideoId(videoId)) {
            logger.warn(`[YouTubeParser] Could not extract video ID from: ${url}`);
            return {
                success: false,
                error: ParseError.NO_VIDEO_ID,
                message: 'Could not extract a valid video ID from the URL'
            };
        }

        // Step 3: 메타데이터 조회
        try {
            let videoInfo;

            if (this.apiKey) {
                // YouTube Data API v3 사용
                try {
                    videoInfo = await this.fetchViaDataApi(videoId);
                } catch (apiError) {
                    // Rate limit 시 oEmbed fallback
                    if (apiError.code === ParseError.RATE_LIMITED) {
                        logger.warn('[YouTubeParser] API rate limited, falling back to oEmbed');
                        videoInfo = await this.fetchViaOEmbed(videoId);
                    } else {
                        throw apiError;
                    }
                }
            } else {
                // oEmbed 사용
                try {
                    videoInfo = await this.fetchViaOEmbed(videoId);
                } catch {
                    // noembed fallback
                    logger.warn('[YouTubeParser] oEmbed failed, trying noembed');
                    videoInfo = await this.fetchViaNoembed(videoId);
                }
            }

            logger.info(`[YouTubeParser] Successfully parsed video: ${videoId}`, {
                title: videoInfo.title,
                duration: videoInfo.duration_seconds
            });

            return {
                success: true,
                data: videoInfo
            };

        } catch (error) {
            const errorCode = error.code || ParseError.API_ERROR;
            const errorMessage = this.getErrorMessage(errorCode);

            logger.error(`[YouTubeParser] Failed to fetch video metadata`, {
                videoId,
                error: errorCode,
                status: error.status
            });

            return {
                success: false,
                error: errorCode,
                message: errorMessage
            };
        }
    }

    /**
     * Video ID만으로 직접 파싱
     * @param {string} videoId - YouTube Video ID
     * @returns {Promise<Object>} 파싱 결과
     */
    async parseById(videoId) {
        if (!this.isValidVideoId(videoId)) {
            return {
                success: false,
                error: ParseError.NO_VIDEO_ID,
                message: 'Invalid video ID format'
            };
        }

        return this.parse(`https://www.youtube.com/watch?v=${videoId}`);
    }

    /**
     * 에러 코드에 해당하는 사용자 친화적 메시지
     * @param {string} errorCode - 에러 코드
     * @returns {string} 에러 메시지
     */
    getErrorMessage(errorCode) {
        const messages = {
            [ParseError.INVALID_URL]: 'The provided URL is not a valid YouTube URL',
            [ParseError.NO_VIDEO_ID]: 'Could not extract a valid video ID from the URL',
            [ParseError.VIDEO_NOT_FOUND]: 'The requested video does not exist or is private',
            [ParseError.API_ERROR]: 'Failed to fetch video information from YouTube',
            [ParseError.RATE_LIMITED]: 'YouTube API rate limit exceeded, please try again later'
        };

        return messages[errorCode] || 'An unknown error occurred';
    }

    // ========================================================================
    // 유틸리티
    // ========================================================================

    /**
     * duration_seconds를 "H:MM:SS" 형식으로 변환
     * @param {number} seconds - 초 단위 duration
     * @returns {string} 포맷된 문자열
     */
    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0:00';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 썸네일 URL 생성 (다양한 품질)
     * @param {string} videoId - Video ID
     * @param {string} quality - 품질 ('default' | 'medium' | 'high' | 'maxres')
     * @returns {string} 썸네일 URL
     */
    getThumbnailUrl(videoId, quality = 'medium') {
        const qualityMap = {
            default: 'default',
            medium: 'mqdefault',
            high: 'hqdefault',
            maxres: 'maxresdefault'
        };

        const suffix = qualityMap[quality] || 'mqdefault';
        return `https://i.ytimg.com/vi/${videoId}/${suffix}.jpg`;
    }

    /**
     * YouTube 비디오 직접 링크 생성
     * @param {string} videoId - Video ID
     * @returns {string} YouTube URL
     */
    getVideoUrl(videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
}

// 에러 타입 내보내기
YouTubeParser.ParseError = ParseError;

module.exports = YouTubeParser;

