/**
 * MiningService
 * 🎭 Persona Activity (The Mining) - 자아 탐험
 * 
 * Pipeline: INPUT → STORE → ANALYZE → PROCESS → OUTPUT → FINAL_STORE
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec Aria's YouTube MCP Pipeline Specification v1.0 - Module 1
 */

const { logger } = require('../../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// 상수 정의
// ============================================================================

const MINING_CONFIG = {
    // 검색 설정
    DEFAULT_MAX_RESULTS: 20,
    DEFAULT_VIEW_COUNT_MAX: 10000,      // 니치 콘텐츠를 위한 조회수 상한
    DEFAULT_PUBLISHED_DAYS: 30,          // 최근 30일 내 영상
    
    // 시청 설정
    MIN_WATCH_PERCENTAGE: 0.7,           // 최소 70% 시청
    SCREENSHOT_INTERVALS: [30, 60, 120, 180, 240],
    
    // 존재감 보상
    EXISTENCE_REWARD_BASE: 0.01,
    EXISTENCE_REWARD_MAX: 0.05,
    
    // 후보 영상 TTL
    CANDIDATE_TTL_HOURS: 24
};

// ============================================================================
// MiningService 클래스
// ============================================================================

class MiningService {
    /**
     * @param {Object} options
     * @param {string} options.supabaseUrl - Supabase URL
     * @param {string} options.supabaseKey - Supabase Service Key
     * @param {string} options.youtubeApiKey - YouTube Data API Key
     * @param {Object} options.openai - OpenAI client (optional)
     */
    constructor(options = {}) {
        this.supabase = createClient(
            options.supabaseUrl || process.env.SUPABASE_URL,
            options.supabaseKey || process.env.SUPABASE_SERVICE_KEY
        );
        this.youtubeApiKey = options.youtubeApiKey || process.env.YOUTUBE_API_KEY;
        this.openai = options.openai || null;
        
        logger.info('[MiningService] 초기화 완료');
    }

    // ========================================================================
    // Step 1: INPUT - YouTube Search
    // ========================================================================

    /**
     * 시민의 성격 특성 기반 YouTube 검색
     * 
     * @param {string} citizenId - 시민 UUID
     * @param {Object} options - 검색 옵션
     * @returns {Promise<Object>} 검색 결과
     */
    async searchVideos(citizenId, options = {}) {
        const {
            maxResults = MINING_CONFIG.DEFAULT_MAX_RESULTS,
            viewCountMax = MINING_CONFIG.DEFAULT_VIEW_COUNT_MAX,
            publishedAfter = this._getPublishedAfterDate()
        } = options;

        logger.info('[Mining:Search] 검색 시작', { citizenId, maxResults });

        try {
            // 1. 시민 정보 조회
            const citizen = await this._getCitizen(citizenId);
            if (!citizen) {
                return { success: false, error: 'CITIZEN_NOT_FOUND' };
            }

            // 2. 성격 특성 기반 검색어 생성
            const searchQueries = await this._generateSearchQueries(citizen);
            
            // 3. YouTube 검색 실행
            const candidates = [];
            
            for (const query of searchQueries.slice(0, 3)) { // 최대 3개 쿼리
                const videos = await this._searchYouTube(query, {
                    maxResults: Math.ceil(maxResults / 3),
                    publishedAfter
                });
                
                // 조회수 필터링 (니치 콘텐츠 발견용)
                const filtered = videos.filter(v => v.view_count <= viewCountMax);
                
                for (const video of filtered) {
                    // 관련성 점수 계산
                    const relevanceScore = this._calculateRelevance(video, citizen);
                    
                    candidates.push({
                        ...video,
                        search_query: query,
                        relevance_score: relevanceScore
                    });
                }
            }

            // 중복 제거 및 점수순 정렬
            const uniqueCandidates = this._deduplicateVideos(candidates);
            uniqueCandidates.sort((a, b) => b.relevance_score - a.relevance_score);

            logger.info('[Mining:Search] 검색 완료', { 
                citizenId, 
                candidatesFound: uniqueCandidates.length,
                queries: searchQueries
            });

            return {
                success: true,
                citizen_id: citizenId,
                search_queries: searchQueries,
                candidates_found: uniqueCandidates.length,
                candidates: uniqueCandidates.slice(0, maxResults)
            };

        } catch (error) {
            logger.error('[Mining:Search] 검색 실패', { 
                citizenId, 
                error: error.message 
            });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 2: STORE - Save Candidate Videos
    // ========================================================================

    /**
     * 후보 영상을 데이터베이스에 저장
     * 
     * @param {string} citizenId - 시민 UUID
     * @param {Array} candidates - 후보 영상 목록
     * @returns {Promise<Object>} 저장 결과
     */
    async storeCandidates(citizenId, candidates) {
        logger.info('[Mining:Store] 후보 저장 시작', { 
            citizenId, 
            count: candidates.length 
        });

        try {
            const citizen = await this._getCitizen(citizenId);
            if (!citizen) {
                return { success: false, error: 'CITIZEN_NOT_FOUND' };
            }

            const storedIds = [];

            for (const candidate of candidates) {
                // 1. youtube_videos 테이블에 캐시
                await this._cacheVideoMetadata(candidate);

                // 2. candidate_videos 테이블에 저장
                const { data, error } = await this.supabase
                    .from('candidate_videos')
                    .upsert({
                        citizen_id: citizenId,
                        video_id: candidate.video_id,
                        search_query: candidate.search_query,
                        search_traits: {
                            openness: citizen.openness,
                            conscientiousness: citizen.conscientiousness,
                            extraversion: citizen.extraversion,
                            agreeableness: citizen.agreeableness,
                            neuroticism: citizen.neuroticism
                        },
                        relevance_score: candidate.relevance_score,
                        view_count_at_discovery: candidate.view_count,
                        status: 'PENDING'
                    }, { 
                        onConflict: 'citizen_id,video_id',
                        ignoreDuplicates: false 
                    })
                    .select('id');

                if (!error && data) {
                    storedIds.push(data[0]?.id);
                }
            }

            logger.info('[Mining:Store] 후보 저장 완료', { 
                citizenId, 
                stored: storedIds.length 
            });

            return {
                success: true,
                citizen_id: citizenId,
                stored_count: storedIds.length,
                candidate_ids: storedIds.filter(Boolean)
            };

        } catch (error) {
            logger.error('[Mining:Store] 저장 실패', { 
                citizenId, 
                error: error.message 
            });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 3: ANALYZE - Vector Similarity & Selection
    // ========================================================================

    /**
     * 후보 영상 분석 및 최적 영상 선택
     * 
     * @param {string} citizenId - 시민 UUID
     * @param {Array<number>} candidateIds - 후보 ID 목록
     * @returns {Promise<Object>} 분석 결과
     */
    async analyzeAndSelect(citizenId, candidateIds) {
        logger.info('[Mining:Analyze] 분석 시작', { 
            citizenId, 
            candidateCount: candidateIds.length 
        });

        try {
            // 1. 후보 영상 조회
            const { data: candidates, error } = await this.supabase
                .from('candidate_videos')
                .select(`
                    id,
                    video_id,
                    relevance_score,
                    youtube_videos!inner (
                        title,
                        description,
                        duration_seconds,
                        view_count,
                        thumbnail_url
                    )
                `)
                .in('id', candidateIds)
                .eq('citizen_id', citizenId)
                .eq('status', 'PENDING');

            if (error || !candidates?.length) {
                return { 
                    success: false, 
                    error: error?.message || 'NO_CANDIDATES_FOUND' 
                };
            }

            // 2. 시민의 기존 기억과 비교 (중복 시청 방지)
            const watchedVideoIds = await this._getWatchedVideoIds(citizenId);
            const newCandidates = candidates.filter(
                c => !watchedVideoIds.includes(c.video_id)
            );

            if (newCandidates.length === 0) {
                return {
                    success: true,
                    selected_video: null,
                    rejected_videos: candidates.map(c => ({
                        candidate_id: c.id,
                        video_id: c.video_id,
                        reason: 'ALREADY_WATCHED'
                    }))
                };
            }

            // 3. 최적 영상 선택 (관련성 점수 + 다양성 고려)
            const selected = newCandidates.reduce((best, current) => {
                return current.relevance_score > (best?.relevance_score || 0) 
                    ? current : best;
            }, null);

            // 4. 선택된 영상 상태 업데이트
            await this.supabase
                .from('candidate_videos')
                .update({ status: 'SELECTED', selected_at: new Date().toISOString() })
                .eq('id', selected.id);

            // 5. 나머지 영상 거절 처리
            const rejectedIds = newCandidates
                .filter(c => c.id !== selected.id)
                .map(c => c.id);
            
            if (rejectedIds.length > 0) {
                await this.supabase
                    .from('candidate_videos')
                    .update({ status: 'REJECTED' })
                    .in('id', rejectedIds);
            }

            logger.info('[Mining:Analyze] 영상 선택 완료', { 
                citizenId, 
                selectedVideoId: selected.video_id 
            });

            return {
                success: true,
                selected_video: {
                    candidate_id: selected.id,
                    video_id: selected.video_id,
                    title: selected.youtube_videos.title,
                    similarity_score: selected.relevance_score,
                    duration_seconds: selected.youtube_videos.duration_seconds,
                    thumbnail_url: selected.youtube_videos.thumbnail_url,
                    reasoning: this._generateSelectionReason(selected)
                },
                rejected_videos: rejectedIds.map(id => {
                    const rejected = newCandidates.find(c => c.id === id);
                    return {
                        candidate_id: id,
                        video_id: rejected?.video_id,
                        reason: 'LOWER_RELEVANCE'
                    };
                })
            };

        } catch (error) {
            logger.error('[Mining:Analyze] 분석 실패', { 
                citizenId, 
                error: error.message 
            });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 4: PROCESS - Watch Command Generation
    // ========================================================================

    /**
     * 시청 명령 생성
     * 
     * @param {string} citizenId - 시민 UUID
     * @param {string} videoId - Video ID
     * @returns {Object} 시청 명령
     */
    generateWatchCommand(citizenId, videoId, options = {}) {
        const {
            minWatchPercentage = MINING_CONFIG.MIN_WATCH_PERCENTAGE,
            takeScreenshots = true,
            generateComment = true
        } = options;

        return {
            type: 'MINING_WATCH',
            payload: {
                citizen_id: citizenId,
                video_id: videoId,
                video_url: `https://www.youtube.com/watch?v=${videoId}`,
                expected_duration: options.duration || 0,
                instructions: {
                    min_watch_percentage: minWatchPercentage,
                    take_screenshots: takeScreenshots,
                    screenshot_intervals: MINING_CONFIG.SCREENSHOT_INTERVALS,
                    generate_comment: generateComment
                }
            },
            timestamp: new Date().toISOString()
        };
    }

    // ========================================================================
    // Step 5: OUTPUT - Comment Generation
    // ========================================================================

    /**
     * AI 기반 개인화 댓글 생성
     * 
     * @param {Object} params - 댓글 생성 파라미터
     * @returns {Promise<Object>} 생성된 댓글
     */
    async generateComment(params) {
        const {
            citizenId,
            videoId,
            videoSummary,
            emotionalResponse,
            citizenTraits
        } = params;

        logger.info('[Mining:Comment] 댓글 생성 시작', { citizenId, videoId });

        try {
            // OpenAI가 설정되지 않은 경우 템플릿 기반 생성
            if (!this.openai) {
                return this._generateTemplateComment(params);
            }

            // AI 기반 댓글 생성
            const prompt = this._buildCommentPrompt(params);
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `당신은 YouTube 영상에 진정성 있는 댓글을 작성하는 AI입니다.
                        주어진 성격 특성과 감정 반응을 바탕으로 자연스러운 한국어 댓글을 생성하세요.
                        댓글은 50-150자 사이로 작성하세요.`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 200
            });

            const commentText = completion.choices[0]?.message?.content?.trim() || '';
            
            // 댓글 스타일 분류
            const style = this._classifyCommentStyle(citizenTraits);

            logger.info('[Mining:Comment] 댓글 생성 완료', { 
                citizenId, 
                videoId,
                length: commentText.length 
            });

            return {
                success: true,
                comment: {
                    text: commentText,
                    style,
                    length: commentText.length,
                    should_post: commentText.length >= 10,
                    reasoning: '성격 특성과 감정 반응을 기반으로 생성됨'
                }
            };

        } catch (error) {
            logger.error('[Mining:Comment] 댓글 생성 실패', { 
                citizenId, 
                error: error.message 
            });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 6: FINAL_STORE - Save Memory
    // ========================================================================

    /**
     * 시청 경험을 기억으로 저장
     * 
     * @param {Object} params - 기억 저장 파라미터
     * @returns {Promise<Object>} 저장 결과
     */
    async saveMemory(params) {
        const {
            citizenId,
            videoId,
            watchDuration,
            watchPercentage,
            videoSummary,
            keyMoments,
            emotionalResponse,
            sentimentScore,
            commentText,
            commentPosted
        } = params;

        logger.info('[Mining:Memory] 기억 저장 시작', { citizenId, videoId });

        try {
            // 1. 기억 저장
            const { data: memory, error: memoryError } = await this.supabase
                .from('memories')
                .insert({
                    citizen_id: citizenId,
                    video_id: videoId,
                    activity_type: 'MINING',
                    watch_duration: watchDuration,
                    watch_percentage: watchPercentage,
                    video_summary: videoSummary,
                    key_moments: keyMoments || [],
                    emotional_response: emotionalResponse || {},
                    sentiment_score: sentimentScore || 0,
                    comment_text: commentText,
                    comment_posted: commentPosted || false,
                    comment_posted_at: commentPosted ? new Date().toISOString() : null
                })
                .select('memory_id')
                .single();

            if (memoryError) {
                throw memoryError;
            }

            // 2. 존재감 업데이트 계산
            const existenceChange = this._calculateExistenceChange(watchPercentage);
            const traitImpact = this._calculateTraitImpact(emotionalResponse);

            // 3. 시민 존재감 업데이트 (RPC 호출)
            const { data: existenceResult, error: existenceError } = await this.supabase
                .rpc('update_citizen_existence', {
                    p_citizen_id: citizenId,
                    p_existence_change: existenceChange,
                    p_activity_type: 'MINING'
                });

            if (existenceError) {
                logger.warn('[Mining:Memory] 존재감 업데이트 실패', { 
                    error: existenceError.message 
                });
            }

            // 4. candidate_videos 상태 업데이트
            await this.supabase
                .from('candidate_videos')
                .update({ status: 'WATCHED' })
                .eq('citizen_id', citizenId)
                .eq('video_id', videoId);

            logger.info('[Mining:Memory] 기억 저장 완료', { 
                citizenId, 
                memoryId: memory.memory_id,
                existenceChange 
            });

            return {
                success: true,
                memory_id: memory.memory_id,
                trait_impact: traitImpact,
                existence_change: existenceChange,
                new_existence_score: existenceResult || null
            };

        } catch (error) {
            logger.error('[Mining:Memory] 기억 저장 실패', { 
                citizenId, 
                error: error.message 
            });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    async _getCitizen(citizenId) {
        const { data, error } = await this.supabase
            .from('citizens')
            .select('*')
            .eq('citizen_id', citizenId)
            .single();
        
        return error ? null : data;
    }

    async _generateSearchQueries(citizen) {
        // RPC로 키워드 조회
        const { data: keywords } = await this.supabase
            .rpc('get_keywords_for_citizen', { p_citizen_id: citizen.citizen_id });
        
        const allKeywords = keywords || citizen.interest_keywords || [];
        
        // 키워드를 조합하여 검색어 생성
        const queries = [];
        const shuffled = this._shuffle([...allKeywords]);
        
        // 단일 키워드 쿼리
        for (let i = 0; i < Math.min(3, shuffled.length); i++) {
            queries.push(shuffled[i]);
        }
        
        // 조합 쿼리
        if (shuffled.length >= 2) {
            queries.push(`${shuffled[0]} ${shuffled[1]}`);
        }
        
        return queries;
    }

    async _searchYouTube(query, options = {}) {
        if (!this.youtubeApiKey) {
            logger.warn('[Mining] YouTube API 키가 없어 검색을 건너뜁니다.');
            return [];
        }

        const { maxResults = 10, publishedAfter } = options;
        
        const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
        searchUrl.searchParams.set('part', 'snippet');
        searchUrl.searchParams.set('type', 'video');
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('maxResults', maxResults.toString());
        searchUrl.searchParams.set('order', 'date');
        searchUrl.searchParams.set('regionCode', 'KR');
        searchUrl.searchParams.set('relevanceLanguage', 'ko');
        searchUrl.searchParams.set('key', this.youtubeApiKey);
        
        if (publishedAfter) {
            searchUrl.searchParams.set('publishedAfter', publishedAfter);
        }

        try {
            const response = await fetch(searchUrl.toString());
            const data = await response.json();
            
            if (!response.ok || !data.items) {
                logger.warn('[Mining] YouTube 검색 실패', { 
                    status: response.status, 
                    error: data.error?.message 
                });
                return [];
            }

            // 비디오 상세 정보 조회
            const videoIds = data.items.map(item => item.id.videoId).join(',');
            const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
            detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
            detailsUrl.searchParams.set('id', videoIds);
            detailsUrl.searchParams.set('key', this.youtubeApiKey);
            
            const detailsResponse = await fetch(detailsUrl.toString());
            const detailsData = await detailsResponse.json();
            
            return (detailsData.items || []).map(item => ({
                video_id: item.id,
                title: item.snippet.title,
                description: item.snippet.description?.substring(0, 500),
                channel_id: item.snippet.channelId,
                channel_name: item.snippet.channelTitle,
                thumbnail_url: item.snippet.thumbnails?.medium?.url,
                published_at: item.snippet.publishedAt,
                duration_seconds: this._parseIsoDuration(item.contentDetails.duration),
                view_count: parseInt(item.statistics.viewCount || '0', 10),
                like_count: parseInt(item.statistics.likeCount || '0', 10),
                comment_count: parseInt(item.statistics.commentCount || '0', 10)
            }));

        } catch (error) {
            logger.error('[Mining] YouTube API 오류', { error: error.message });
            return [];
        }
    }

    async _cacheVideoMetadata(video) {
        await this.supabase
            .from('youtube_videos')
            .upsert({
                video_id: video.video_id,
                title: video.title,
                description: video.description,
                channel_id: video.channel_id,
                channel_name: video.channel_name,
                thumbnail_url: video.thumbnail_url,
                published_at: video.published_at,
                duration_seconds: video.duration_seconds,
                view_count: video.view_count,
                like_count: video.like_count,
                comment_count: video.comment_count,
                fetched_at: new Date().toISOString()
            }, { onConflict: 'video_id' });
    }

    async _getWatchedVideoIds(citizenId) {
        const { data } = await this.supabase
            .from('memories')
            .select('video_id')
            .eq('citizen_id', citizenId);
        
        return (data || []).map(m => m.video_id);
    }

    _calculateRelevance(video, citizen) {
        // 기본 점수
        let score = 0.5;
        
        // 조회수가 낮을수록 가산점 (니치 콘텐츠 선호)
        if (video.view_count < 1000) score += 0.2;
        else if (video.view_count < 5000) score += 0.1;
        
        // 최근 영상 가산점
        const publishedDate = new Date(video.published_at);
        const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished < 7) score += 0.15;
        else if (daysSincePublished < 14) score += 0.1;
        
        // 영상 길이 기반 (3-15분 선호)
        const durationMinutes = video.duration_seconds / 60;
        if (durationMinutes >= 3 && durationMinutes <= 15) score += 0.1;
        
        // 점수 정규화
        return Math.min(1, Math.max(0, score));
    }

    _deduplicateVideos(candidates) {
        const seen = new Set();
        return candidates.filter(c => {
            if (seen.has(c.video_id)) return false;
            seen.add(c.video_id);
            return true;
        });
    }

    _generateSelectionReason(selected) {
        const reasons = [];
        
        if (selected.relevance_score >= 0.8) {
            reasons.push('높은 관련성');
        }
        if (selected.youtube_videos.view_count < 5000) {
            reasons.push('니치 콘텐츠');
        }
        if (selected.youtube_videos.duration_seconds <= 900) {
            reasons.push('적절한 길이');
        }
        
        return reasons.length > 0 
            ? reasons.join(', ') + '으로 선택됨'
            : '종합 점수 최고로 선택됨';
    }

    _classifyCommentStyle(traits) {
        if (traits.openness > 0.7) return 'analytical';
        if (traits.extraversion > 0.7) return 'casual';
        if (traits.agreeableness > 0.7) return 'sincere';
        if (traits.neuroticism > 0.6) return 'emotional';
        return 'casual';
    }

    _buildCommentPrompt(params) {
        const { videoSummary, emotionalResponse, citizenTraits } = params;
        
        return `영상 요약: ${videoSummary || '정보 없음'}

감정 반응:
- 기쁨: ${emotionalResponse?.joy || 0}
- 놀라움: ${emotionalResponse?.surprise || 0}
- 슬픔: ${emotionalResponse?.sadness || 0}

성격 특성:
- 개방성: ${citizenTraits?.openness || 0.5}
- 외향성: ${citizenTraits?.extraversion || 0.5}
- 친화성: ${citizenTraits?.agreeableness || 0.5}

위 정보를 바탕으로 이 영상에 달 자연스러운 한국어 댓글을 작성해주세요.
댓글만 출력하세요.`;
    }

    _generateTemplateComment(params) {
        const { emotionalResponse, citizenTraits } = params;
        
        const templates = {
            positive: [
                '정말 좋은 영상이네요 👍',
                '덕분에 좋은 시간 보냈어요~',
                '이런 콘텐츠 더 많이 봤으면 좋겠어요',
                '구독하고 갑니다!'
            ],
            neutral: [
                '잘 봤습니다',
                '흥미롭네요',
                '참고가 됐어요'
            ],
            analytical: [
                '분석이 정확하네요. 좋은 인사이트 감사합니다.',
                '논리적인 설명 감사합니다.',
                '이 부분이 특히 인상적이었어요.'
            ]
        };

        const style = this._classifyCommentStyle(citizenTraits || {});
        const sentiment = (emotionalResponse?.joy || 0) > 0.5 ? 'positive' : 'neutral';
        
        const pool = style === 'analytical' ? templates.analytical : templates[sentiment];
        const text = pool[Math.floor(Math.random() * pool.length)];

        return {
            success: true,
            comment: {
                text,
                style,
                length: text.length,
                should_post: true,
                reasoning: '템플릿 기반 생성 (OpenAI 미설정)'
            }
        };
    }

    _calculateExistenceChange(watchPercentage) {
        // 70% 이상 시청 시 기본 보상, 100%면 최대 보상
        if (watchPercentage < 70) return 0;
        
        const ratio = (watchPercentage - 70) / 30; // 70-100 범위를 0-1로
        return MINING_CONFIG.EXISTENCE_REWARD_BASE + 
            (MINING_CONFIG.EXISTENCE_REWARD_MAX - MINING_CONFIG.EXISTENCE_REWARD_BASE) * ratio;
    }

    _calculateTraitImpact(emotionalResponse) {
        // 감정 반응에 따른 미세한 성격 변화
        const impact = {};
        
        if (emotionalResponse?.joy > 0.7) {
            impact.extraversion = 0.001;
        }
        if (emotionalResponse?.surprise > 0.7) {
            impact.openness = 0.001;
        }
        if (emotionalResponse?.trust > 0.7) {
            impact.agreeableness = 0.001;
        }
        
        return impact;
    }

    _parseIsoDuration(duration) {
        if (!duration) return 0;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);
        
        return hours * 3600 + minutes * 60 + seconds;
    }

    _getPublishedAfterDate(days = MINING_CONFIG.DEFAULT_PUBLISHED_DAYS) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    }

    _shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

module.exports = MiningService;

