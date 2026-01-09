/**
 * YouTube MCP Server
 * 
 * Model Context Protocol Server for YouTube Data API
 * 
 * Tools:
 * - youtube.search: YouTube 검색
 * - youtube.trending: 트렌딩 영상 조회
 * - youtube.video.details: 영상 상세 정보
 * - youtube.transcript: 자막 조회
 * - youtube.comments.list: 댓글 목록
 * - youtube.comments.analyze: 댓글 감정 분석
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec Aria's YouTube MCP Pipeline Specification v1.0
 */

const logger = require('../utils/logger');

// ============================================================================
// 상수 정의
// ============================================================================

const DEFAULT_REGION = 'KR';
const DEFAULT_LANGUAGE = 'ko';
const MAX_RESULTS = 50;

// YouTube 카테고리 ID 매핑
const CATEGORY_IDS = {
    film: '1',
    music: '10',
    gaming: '20',
    news: '25',
    sports: '17',
    education: '27',
    science: '28',
    entertainment: '24',
    comedy: '23',
    howto: '26'
};

// ============================================================================
// YouTubeMCPServer 클래스
// ============================================================================

class YouTubeMCPServer {
    /**
     * @param {Object} options
     * @param {string} options.apiKey - YouTube Data API v3 Key
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.YOUTUBE_API_KEY;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        
        if (!this.apiKey) {
            logger.warn('[YT-MCP] API 키가 설정되지 않음');
        }

        // 도구 정의
        this.tools = this._defineTools();
    }

    // ========================================================================
    // MCP Tool Definitions
    // ========================================================================

    _defineTools() {
        return {
            'youtube.search': {
                name: 'youtube.search',
                description: 'YouTube 검색 - 키워드로 영상 검색',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: '검색어' },
                        maxResults: { type: 'number', default: 20 },
                        order: { 
                            type: 'string', 
                            enum: ['date', 'relevance', 'viewCount', 'rating'],
                            default: 'relevance'
                        },
                        publishedAfter: { type: 'string', description: 'ISO 8601 날짜' },
                        videoDuration: {
                            type: 'string',
                            enum: ['short', 'medium', 'long'],
                            description: 'short(<4분), medium(4-20분), long(>20분)'
                        },
                        regionCode: { type: 'string', default: 'KR' }
                    },
                    required: ['query']
                },
                handler: this.search.bind(this)
            },

            'youtube.trending': {
                name: 'youtube.trending',
                description: 'YouTube 트렌딩 - 인기 급상승 영상 조회',
                inputSchema: {
                    type: 'object',
                    properties: {
                        regionCode: { type: 'string', default: 'KR' },
                        categoryId: { 
                            type: 'string', 
                            description: '카테고리 ID (music, gaming, news 등)'
                        },
                        maxResults: { type: 'number', default: 20 }
                    }
                },
                handler: this.getTrending.bind(this)
            },

            'youtube.video.details': {
                name: 'youtube.video.details',
                description: 'YouTube 영상 상세 정보 조회',
                inputSchema: {
                    type: 'object',
                    properties: {
                        videoId: { type: 'string', description: '11자리 Video ID' }
                    },
                    required: ['videoId']
                },
                handler: this.getVideoDetails.bind(this)
            },

            'youtube.transcript': {
                name: 'youtube.transcript',
                description: 'YouTube 영상 자막 조회 (가능한 경우)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        videoId: { type: 'string' },
                        language: { type: 'string', default: 'ko' }
                    },
                    required: ['videoId']
                },
                handler: this.getTranscript.bind(this)
            },

            'youtube.comments.list': {
                name: 'youtube.comments.list',
                description: 'YouTube 영상 댓글 목록 조회',
                inputSchema: {
                    type: 'object',
                    properties: {
                        videoId: { type: 'string' },
                        maxResults: { type: 'number', default: 20 },
                        order: { 
                            type: 'string', 
                            enum: ['time', 'relevance'],
                            default: 'relevance'
                        }
                    },
                    required: ['videoId']
                },
                handler: this.getComments.bind(this)
            },

            'youtube.comments.analyze': {
                name: 'youtube.comments.analyze',
                description: '댓글 감정 분석 - 댓글 텍스트 배열의 감정 분석',
                inputSchema: {
                    type: 'object',
                    properties: {
                        comments: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: '분석할 댓글 텍스트 배열'
                        }
                    },
                    required: ['comments']
                },
                handler: this.analyzeComments.bind(this)
            }
        };
    }

    // ========================================================================
    // Tool Handlers
    // ========================================================================

    /**
     * YouTube 검색
     */
    async search(params) {
        const {
            query,
            maxResults = 20,
            order = 'relevance',
            publishedAfter,
            videoDuration,
            regionCode = DEFAULT_REGION
        } = params;

        logger.debug('[YT-MCP:Search] 검색', { query, maxResults });

        if (!this.apiKey) {
            return { error: 'API_KEY_MISSING', videos: [] };
        }

        try {
            const url = new URL(`${this.baseUrl}/search`);
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('type', 'video');
            url.searchParams.set('q', query);
            url.searchParams.set('maxResults', Math.min(maxResults, MAX_RESULTS).toString());
            url.searchParams.set('order', order);
            url.searchParams.set('regionCode', regionCode);
            url.searchParams.set('relevanceLanguage', DEFAULT_LANGUAGE);
            url.searchParams.set('key', this.apiKey);

            if (publishedAfter) {
                url.searchParams.set('publishedAfter', publishedAfter);
            }
            if (videoDuration) {
                url.searchParams.set('videoDuration', videoDuration);
            }

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok) {
                logger.error('[YT-MCP:Search] API 오류', { error: data.error?.message });
                return { error: data.error?.message, videos: [] };
            }

            // Video ID 목록으로 상세 정보 조회
            const videoIds = data.items?.map(item => item.id.videoId).join(',');
            if (!videoIds) {
                return { videos: [] };
            }

            const videos = await this._getVideosDetails(videoIds);

            return { videos };

        } catch (e) {
            logger.error('[YT-MCP:Search] 오류', { error: e.message });
            return { error: e.message, videos: [] };
        }
    }

    /**
     * 트렌딩 영상 조회
     */
    async getTrending(params = {}) {
        const {
            regionCode = DEFAULT_REGION,
            categoryId,
            maxResults = 20
        } = params;

        logger.debug('[YT-MCP:Trending] 조회', { regionCode, categoryId });

        if (!this.apiKey) {
            return { error: 'API_KEY_MISSING', videos: [] };
        }

        try {
            const url = new URL(`${this.baseUrl}/videos`);
            url.searchParams.set('part', 'snippet,contentDetails,statistics');
            url.searchParams.set('chart', 'mostPopular');
            url.searchParams.set('regionCode', regionCode);
            url.searchParams.set('maxResults', Math.min(maxResults, MAX_RESULTS).toString());
            url.searchParams.set('key', this.apiKey);

            if (categoryId) {
                const catId = CATEGORY_IDS[categoryId] || categoryId;
                url.searchParams.set('videoCategoryId', catId);
            }

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok) {
                return { error: data.error?.message, videos: [] };
            }

            const videos = (data.items || []).map((item, index) => ({
                video_id: item.id,
                title: item.snippet.title,
                channel_id: item.snippet.channelId,
                channel_name: item.snippet.channelTitle,
                description: item.snippet.description?.substring(0, 500),
                thumbnail_url: item.snippet.thumbnails?.medium?.url,
                published_at: item.snippet.publishedAt,
                trending_rank: index + 1,
                duration_seconds: this._parseIsoDuration(item.contentDetails.duration),
                view_count: parseInt(item.statistics.viewCount || '0', 10),
                like_count: parseInt(item.statistics.likeCount || '0', 10),
                comment_count: parseInt(item.statistics.commentCount || '0', 10)
            }));

            return { videos };

        } catch (e) {
            logger.error('[YT-MCP:Trending] 오류', { error: e.message });
            return { error: e.message, videos: [] };
        }
    }

    /**
     * 영상 상세 정보 조회
     */
    async getVideoDetails(params) {
        const { videoId } = params;

        // videoId 입력 유효성 검증
        if (typeof videoId !== 'string' || videoId.trim() === '') {
            logger.warn('[YT-MCP:Details] 유효하지 않은 videoId', { videoId });
            return { error: 'INVALID_VIDEO_ID', video: null };
        }

        // YouTube Video ID 형식 검증 (11자리 영숫자 + 하이픈 + 언더스코어)
        const trimmedVideoId = videoId.trim();
        if (!/^[A-Za-z0-9_-]{11}$/.test(trimmedVideoId)) {
            logger.warn('[YT-MCP:Details] 잘못된 videoId 형식', { videoId: trimmedVideoId });
            return { error: 'INVALID_VIDEO_ID_FORMAT', video: null };
        }

        if (!this.apiKey) {
            return { error: 'API_KEY_MISSING', video: null };
        }

        try {
            const videos = await this._getVideosDetails(trimmedVideoId);
            return { video: videos[0] || null };
        } catch (e) {
            logger.error('[YT-MCP:Details] 오류', { error: e.message });
            return { error: e.message, video: null };
        }
    }

    /**
     * 자막 조회
     * Note: YouTube Data API로는 직접 자막 조회가 불가능
     * 실제 구현 시 youtube-transcript 패키지 사용 권장
     */
    async getTranscript(params) {
        const { videoId, language = DEFAULT_LANGUAGE } = params;

        logger.debug('[YT-MCP:Transcript] 조회 시도', { videoId, language });

        // YouTube Data API로는 자막 직접 조회 불가
        // 향후 youtube-transcript 패키지 통합 필요
        return {
            available: false,
            message: 'Direct transcript access not available via YouTube Data API. Consider using youtube-transcript package.',
            video_id: videoId
        };
    }

    /**
     * 댓글 목록 조회
     */
    async getComments(params) {
        const { videoId, maxResults = 20, order = 'relevance' } = params;

        logger.debug('[YT-MCP:Comments] 조회', { videoId, maxResults });

        if (!this.apiKey) {
            return { error: 'API_KEY_MISSING', comments: [] };
        }

        try {
            const url = new URL(`${this.baseUrl}/commentThreads`);
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('videoId', videoId);
            url.searchParams.set('maxResults', Math.min(maxResults, MAX_RESULTS).toString());
            url.searchParams.set('order', order);
            url.searchParams.set('key', this.apiKey);

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok) {
                // 댓글 비활성화된 영상
                if (data.error?.errors?.[0]?.reason === 'commentsDisabled') {
                    return { comments: [], disabled: true };
                }
                return { error: data.error?.message, comments: [] };
            }

            const comments = (data.items || []).map(item => ({
                id: item.id,
                author: item.snippet.topLevelComment.snippet.authorDisplayName,
                text: item.snippet.topLevelComment.snippet.textDisplay,
                like_count: item.snippet.topLevelComment.snippet.likeCount,
                published_at: item.snippet.topLevelComment.snippet.publishedAt,
                reply_count: item.snippet.totalReplyCount
            }));

            return { comments };

        } catch (e) {
            logger.error('[YT-MCP:Comments] 오류', { error: e.message });
            return { error: e.message, comments: [] };
        }
    }

    /**
     * 댓글 감정 분석
     * 규칙 기반 간단한 분석 (AI 통합 전)
     */
    async analyzeComments(params) {
        const { comments } = params;

        if (!comments || comments.length === 0) {
            return {
                overall_sentiment: 'neutral',
                sentiment_score: 0,
                dominant_emotions: [],
                common_phrases: [],
                tone: 'casual'
            };
        }

        logger.debug('[YT-MCP:Analyze] 분석', { commentCount: comments.length });

        // 감정 키워드
        const positiveWords = ['좋', '최고', '대박', '웃', 'ㅋㅋ', 'ㅎㅎ', '감동', '사랑', '굿', '완벽', '짱'];
        const negativeWords = ['별로', '싫', '못', '안돼', '쓰레기', '최악', '실망', '노잼', '지루'];
        const commonPhrases = ['ㅋㅋㅋ', 'ㅎㅎㅎ', '대박', '최고', '와', '진짜', '인정', '공감'];

        let positiveCount = 0;
        let negativeCount = 0;
        const foundPhrases = new Set();

        for (const comment of comments) {
            const text = comment.toLowerCase();
            
            for (const word of positiveWords) {
                if (text.includes(word)) positiveCount++;
            }
            for (const word of negativeWords) {
                if (text.includes(word)) negativeCount++;
            }
            for (const phrase of commonPhrases) {
                if (text.includes(phrase)) foundPhrases.add(phrase);
            }
        }

        const total = positiveCount + negativeCount;
        let sentiment, score, emotions;

        if (total === 0) {
            sentiment = 'neutral';
            score = 0;
            emotions = ['무관심'];
        } else if (positiveCount > negativeCount * 2) {
            sentiment = 'positive';
            score = Math.min(1, positiveCount / (total * 0.5));
            emotions = ['재미', '흥미', '공감'];
        } else if (negativeCount > positiveCount * 2) {
            sentiment = 'negative';
            score = Math.max(-1, -negativeCount / (total * 0.5));
            emotions = ['실망', '분노'];
        } else {
            sentiment = 'mixed';
            score = (positiveCount - negativeCount) / total;
            emotions = ['복합'];
        }

        return {
            overall_sentiment: sentiment,
            sentiment_score: Math.round(score * 100) / 100,
            dominant_emotions: emotions,
            common_phrases: Array.from(foundPhrases).slice(0, 5),
            tone: 'casual'
        };
    }

    // ========================================================================
    // MCP Protocol Interface
    // ========================================================================

    /**
     * 사용 가능한 도구 목록 반환
     */
    listTools() {
        return Object.values(this.tools).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
    }

    /**
     * 도구 실행
     */
    async callTool(name, arguments_) {
        const tool = this.tools[name];
        
        if (!tool) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: `Unknown tool: ${name}` })
                }],
                isError: true
            };
        }

        try {
            const result = await tool.handler(arguments_);
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }],
                isError: false
            };
        } catch (e) {
            logger.error(`[YT-MCP] Tool error: ${name}`, { error: e.message });
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: e.message })
                }],
                isError: true
            };
        }
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    async _getVideosDetails(videoIds) {
        const url = new URL(`${this.baseUrl}/videos`);
        url.searchParams.set('part', 'snippet,contentDetails,statistics');
        url.searchParams.set('id', videoIds);
        url.searchParams.set('key', this.apiKey);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok || !data.items) {
            return [];
        }

        return data.items.map(item => ({
            video_id: item.id,
            title: item.snippet.title,
            channel_id: item.snippet.channelId,
            channel_name: item.snippet.channelTitle,
            description: item.snippet.description?.substring(0, 500),
            thumbnail_url: item.snippet.thumbnails?.medium?.url,
            published_at: item.snippet.publishedAt,
            category_id: item.snippet.categoryId,
            tags: item.snippet.tags || [],
            duration_seconds: this._parseIsoDuration(item.contentDetails.duration),
            view_count: parseInt(item.statistics.viewCount || '0', 10),
            like_count: parseInt(item.statistics.likeCount || '0', 10),
            comment_count: parseInt(item.statistics.commentCount || '0', 10)
        }));
    }

    _parseIsoDuration(duration) {
        if (!duration) return 0;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        
        return (parseInt(match[1] || '0', 10) * 3600) +
               (parseInt(match[2] || '0', 10) * 60) +
               parseInt(match[3] || '0', 10);
    }
}

module.exports = YouTubeMCPServer;

