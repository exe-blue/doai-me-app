/**
 * SurfingService
 * 🍿 POP Activity (The Surfing) - 사회 동화
 * 
 * Pipeline: INPUT → STORE → ANALYZE → PROCESS → OUTPUT → FINAL_STORE
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec Aria's YouTube MCP Pipeline Specification v1.0 - Module 2
 */

const { logger } = require('../../utils/logger');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// 상수 정의
// ============================================================================

const SURFING_CONFIG = {
    // 트렌딩 설정
    REGION_CODE: 'KR',
    MAX_TRENDING_RESULTS: 20,
    SAMPLE_COMMENTS_COUNT: 20,
    
    // 브로드캐스트 설정
    DEFAULT_PRIORITY_THRESHOLD: 3,
    DEFAULT_TARGET_COUNT: 50,
    
    // 시청 설정
    MIN_WATCH_PERCENTAGE: 0.6,
    
    // 존재감 보상 (사회 참여)
    EXISTENCE_REWARD_MIN: 0.02,
    EXISTENCE_REWARD_MAX: 0.08,
    
    // 스케줄
    TRENDING_FETCH_INTERVAL_HOURS: 6
};

const SENTIMENT_LABELS = {
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
    NEUTRAL: 'neutral',
    MIXED: 'mixed'
};

// ============================================================================
// SurfingService 클래스
// ============================================================================

class SurfingService {
    /**
     * @param {Object} options
     * @param {string} options.supabaseUrl
     * @param {string} options.supabaseKey
     * @param {string} options.youtubeApiKey
     * @param {Object} options.openai
     */
    constructor(options = {}) {
        this.supabase = createClient(
            options.supabaseUrl || process.env.SUPABASE_URL,
            options.supabaseKey || process.env.SUPABASE_SERVICE_KEY
        );
        this.youtubeApiKey = options.youtubeApiKey || process.env.YOUTUBE_API_KEY;
        this.openai = options.openai || null;
        
        logger.info('[SurfingService] 초기화 완료');
    }

    // ========================================================================
    // Step 1: INPUT - Fetch Trending Videos
    // ========================================================================

    /**
     * YouTube 트렌딩 영상 조회
     * 
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async fetchTrending(options = {}) {
        const {
            regionCode = SURFING_CONFIG.REGION_CODE,
            maxResults = SURFING_CONFIG.MAX_TRENDING_RESULTS,
            categoryId
        } = options;

        logger.info('[Surfing:Trending] 트렌딩 조회 시작', { regionCode, maxResults });

        try {
            if (!this.youtubeApiKey) {
                return { success: false, error: 'YOUTUBE_API_KEY_MISSING' };
            }

            const url = new URL('https://www.googleapis.com/youtube/v3/videos');
            url.searchParams.set('part', 'snippet,contentDetails,statistics');
            url.searchParams.set('chart', 'mostPopular');
            url.searchParams.set('regionCode', regionCode);
            url.searchParams.set('maxResults', maxResults.toString());
            url.searchParams.set('key', this.youtubeApiKey);
            
            if (categoryId) {
                url.searchParams.set('videoCategoryId', categoryId);
            }

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok || !data.items) {
                logger.error('[Surfing:Trending] API 응답 오류', { 
                    status: response.status,
                    error: data.error?.message 
                });
                return { success: false, error: data.error?.message || 'API_ERROR' };
            }

            const videos = data.items.map((item, index) => ({
                video_id: item.id,
                title: item.snippet.title,
                channel_id: item.snippet.channelId,
                channel_name: item.snippet.channelTitle,
                description: item.snippet.description?.substring(0, 500),
                thumbnail_url: item.snippet.thumbnails?.medium?.url,
                published_at: item.snippet.publishedAt,
                category_id: item.snippet.categoryId,
                duration_seconds: this._parseIsoDuration(item.contentDetails.duration),
                trending_rank: index + 1,
                view_count: parseInt(item.statistics.viewCount || '0', 10),
                like_count: parseInt(item.statistics.likeCount || '0', 10),
                comment_count: parseInt(item.statistics.commentCount || '0', 10)
            }));

            logger.info('[Surfing:Trending] 트렌딩 조회 완료', { 
                regionCode, 
                count: videos.length 
            });

            return {
                success: true,
                region_code: regionCode,
                fetched_at: new Date().toISOString(),
                videos
            };

        } catch (error) {
            logger.error('[Surfing:Trending] 조회 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 2: STORE - Save Trending Videos
    // ========================================================================

    /**
     * 트렌딩 영상 저장
     * 
     * @param {Array} videos - 트렌딩 영상 목록
     * @param {string} regionCode
     * @returns {Promise<Object>}
     */
    async storeTrending(videos, regionCode = 'KR') {
        logger.info('[Surfing:Store] 트렌딩 저장 시작', { count: videos.length });

        try {
            // 기존 활성 트렌딩 비활성화
            await this.supabase
                .from('trending_videos')
                .update({ is_active: false })
                .eq('region_code', regionCode)
                .eq('is_active', true);

            const trendingIds = [];

            for (const video of videos) {
                // 1. youtube_videos 캐시
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
                        category_id: video.category_id,
                        fetched_at: new Date().toISOString()
                    }, { onConflict: 'video_id' });

                // 2. 댓글 샘플 조회
                const sampleComments = await this._fetchVideoComments(video.video_id);

                // 3. trending_videos 저장
                const { data, error } = await this.supabase
                    .from('trending_videos')
                    .insert({
                        video_id: video.video_id,
                        region_code: regionCode,
                        category_id: video.category_id,
                        trending_rank: video.trending_rank,
                        view_count_snapshot: video.view_count,
                        like_count_snapshot: video.like_count,
                        comment_count_snapshot: video.comment_count,
                        sample_comments: sampleComments,
                        is_active: true
                    })
                    .select('id');

                if (!error && data?.[0]) {
                    trendingIds.push(data[0].id);
                }
            }

            logger.info('[Surfing:Store] 트렌딩 저장 완료', { 
                stored: trendingIds.length 
            });

            return {
                success: true,
                region_code: regionCode,
                stored_count: trendingIds.length,
                trending_ids: trendingIds
            };

        } catch (error) {
            logger.error('[Surfing:Store] 저장 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 3: ANALYZE - Comment Sentiment Analysis
    // ========================================================================

    /**
     * 댓글 감정 분석
     * 
     * @param {string} videoId
     * @param {Array<string>} comments
     * @returns {Promise<Object>}
     */
    async analyzeComments(videoId, comments = []) {
        logger.info('[Surfing:Analyze] 댓글 분석 시작', { 
            videoId, 
            commentCount: comments.length 
        });

        try {
            if (comments.length === 0) {
                return {
                    success: true,
                    video_id: videoId,
                    analysis: {
                        overall_sentiment: SENTIMENT_LABELS.NEUTRAL,
                        sentiment_score: 0,
                        dominant_emotions: [],
                        common_phrases: [],
                        tone: 'casual'
                    }
                };
            }

            // AI 분석 또는 규칙 기반 분석
            let analysis;
            
            if (this.openai) {
                analysis = await this._analyzeWithAI(comments);
            } else {
                analysis = this._analyzeWithRules(comments);
            }

            // 트렌딩 테이블 업데이트
            await this.supabase
                .from('trending_videos')
                .update({ comment_sentiment: analysis.sentiment_score })
                .eq('video_id', videoId)
                .eq('is_active', true);

            logger.info('[Surfing:Analyze] 댓글 분석 완료', { 
                videoId, 
                sentiment: analysis.overall_sentiment 
            });

            return {
                success: true,
                video_id: videoId,
                analysis
            };

        } catch (error) {
            logger.error('[Surfing:Analyze] 분석 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 4: PROCESS - Broadcast to Citizens
    // ========================================================================

    /**
     * POP 브로드캐스트 - 낮은 우선순위 시민에게 영상 시청 명령
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async broadcast(params) {
        const {
            videoId,
            targetCount = SURFING_CONFIG.DEFAULT_TARGET_COUNT,
            priorityThreshold = SURFING_CONFIG.DEFAULT_PRIORITY_THRESHOLD
        } = params;

        logger.info('[Surfing:Broadcast] 브로드캐스트 시작', { 
            videoId, 
            targetCount,
            priorityThreshold 
        });

        try {
            // 1. 트렌딩 정보 조회
            const { data: trending } = await this.supabase
                .from('trending_videos')
                .select(`
                    id,
                    trending_rank,
                    comment_sentiment,
                    sample_comments,
                    youtube_videos!inner (
                        title,
                        duration_seconds,
                        thumbnail_url
                    )
                `)
                .eq('video_id', videoId)
                .eq('is_active', true)
                .single();

            if (!trending) {
                return { success: false, error: 'TRENDING_NOT_FOUND' };
            }

            // 2. 대상 시민 선택 (우선순위 기반)
            const citizens = await this._selectCitizensForPop(targetCount, priorityThreshold);

            if (citizens.length === 0) {
                return { 
                    success: false, 
                    error: 'NO_ELIGIBLE_CITIZENS',
                    message: '자격 있는 시민이 없습니다.'
                };
            }

            // 3. 브로드캐스트 기록 생성
            const { data: broadcast, error: broadcastError } = await this.supabase
                .from('pop_broadcasts')
                .insert({
                    video_id: videoId,
                    target_count: targetCount,
                    priority_threshold: priorityThreshold,
                    citizens_targeted: citizens.length,
                    status: 'ACTIVE'
                })
                .select('broadcast_id')
                .single();

            if (broadcastError) {
                throw broadcastError;
            }

            // 4. 각 시민에게 society_trends 레코드 생성
            const trendRecords = citizens.map(citizen => ({
                citizen_id: citizen.citizen_id,
                video_id: videoId,
                trending_id: trending.id,
                priority_at_time: citizen.priority,
                assigned_at: new Date().toISOString()
            }));

            await this.supabase
                .from('society_trends')
                .insert(trendRecords);

            // 5. 댓글 분석 결과에서 공통 표현 추출
            const commonPhrases = this._extractCommonPhrases(trending.sample_comments);

            logger.info('[Surfing:Broadcast] 브로드캐스트 완료', { 
                broadcastId: broadcast.broadcast_id,
                targetedCount: citizens.length 
            });

            return {
                success: true,
                broadcast_id: broadcast.broadcast_id,
                video_id: videoId,
                trending_rank: trending.trending_rank,
                comment_sentiment: trending.comment_sentiment,
                common_phrases: commonPhrases,
                targeted_citizens: citizens.map(c => c.citizen_id),
                total_targeted: citizens.length
            };

        } catch (error) {
            logger.error('[Surfing:Broadcast] 브로드캐스트 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 시청 명령 생성
     */
    generateWatchCommand(broadcastId, videoId, options = {}) {
        return {
            type: 'POP_WATCH',
            payload: {
                broadcast_id: broadcastId,
                video_id: videoId,
                video_url: `https://www.youtube.com/watch?v=${videoId}`,
                trending_rank: options.trendingRank || 0,
                comment_sentiment: options.commentSentiment || SENTIMENT_LABELS.NEUTRAL,
                common_phrases: options.commonPhrases || [],
                instructions: {
                    min_watch_percentage: SURFING_CONFIG.MIN_WATCH_PERCENTAGE,
                    generate_conforming_comment: true
                }
            },
            timestamp: new Date().toISOString()
        };
    }

    // ========================================================================
    // Step 5: OUTPUT - Generate Conforming Comment
    // ========================================================================

    /**
     * 동조 댓글 생성 - 사회적 분위기에 맞는 댓글
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async generateConformComment(params) {
        const {
            citizenId,
            videoId,
            commentSentiment,
            commonPhrases,
            citizenExtraversion,
            citizenAgreeableness
        } = params;

        logger.info('[Surfing:Conform] 동조 댓글 생성', { citizenId, videoId });

        try {
            let commentText;
            let conformityScore;

            if (this.openai) {
                // AI 기반 동조 댓글 생성
                const prompt = `현재 이 YouTube 영상의 댓글 분위기는 "${commentSentiment}"입니다.
자주 사용되는 표현: ${commonPhrases.join(', ')}

당신의 외향성: ${citizenExtraversion}, 친화성: ${citizenAgreeableness}

위 분위기에 자연스럽게 동조하는 한국어 댓글을 작성하세요.
50자 이내로 작성하고, 댓글만 출력하세요.`;

                const completion = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: '당신은 YouTube에서 사회적 분위기에 맞게 자연스럽게 어울리는 댓글을 작성합니다.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9,
                    max_tokens: 100
                });

                commentText = completion.choices[0]?.message?.content?.trim() || '';
                conformityScore = 0.8;
            } else {
                // 템플릿 기반 동조 댓글
                const result = this._generateTemplateConformComment(
                    commentSentiment, 
                    commonPhrases, 
                    citizenExtraversion
                );
                commentText = result.text;
                conformityScore = result.conformityScore;
            }

            const shouldPost = citizenAgreeableness > 0.4 && commentText.length >= 3;

            return {
                success: true,
                comment: {
                    text: commentText,
                    conformity_score: conformityScore,
                    should_post: shouldPost
                }
            };

        } catch (error) {
            logger.error('[Surfing:Conform] 댓글 생성 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Step 6: FINAL_STORE - Record Participation
    // ========================================================================

    /**
     * POP 참여 기록 저장
     * 
     * @param {Object} params
     * @returns {Promise<Object>}
     */
    async recordParticipation(params) {
        const {
            citizenId,
            broadcastId,
            videoId,
            trendingId,
            priorityAtTime,
            watchDuration,
            analyzedSentiment,
            generatedComment,
            commentPosted
        } = params;

        logger.info('[Surfing:Record] 참여 기록 시작', { citizenId, videoId });

        try {
            // 1. society_trends 업데이트
            const { error: updateError } = await this.supabase
                .from('society_trends')
                .update({
                    watch_completed_at: new Date().toISOString(),
                    watch_duration: watchDuration,
                    analyzed_sentiment: analyzedSentiment,
                    generated_comment: generatedComment,
                    comment_posted: commentPosted,
                    comment_posted_at: commentPosted ? new Date().toISOString() : null
                })
                .eq('citizen_id', citizenId)
                .eq('video_id', videoId)
                .eq('trending_id', trendingId);

            if (updateError) {
                throw updateError;
            }

            // 2. 존재감 보상 계산 (사회 참여 = 존재감 상승)
            let existenceGained = SURFING_CONFIG.EXISTENCE_REWARD_MIN;
            
            // 댓글 게시 시 추가 보상
            if (commentPosted) {
                existenceGained += 0.03;
            }
            
            // 시청 시간에 따른 추가 보상
            if (watchDuration > 120) { // 2분 이상
                existenceGained += 0.02;
            }

            existenceGained = Math.min(existenceGained, SURFING_CONFIG.EXISTENCE_REWARD_MAX);

            // 3. 존재감 업데이트
            const { data: newExistence } = await this.supabase
                .rpc('update_citizen_existence', {
                    p_citizen_id: citizenId,
                    p_existence_change: existenceGained,
                    p_activity_type: 'SURFING'
                });

            // 4. society_trends에 보상 기록
            await this.supabase
                .from('society_trends')
                .update({ existence_gained: existenceGained })
                .eq('citizen_id', citizenId)
                .eq('video_id', videoId)
                .eq('trending_id', trendingId);

            // 5. 브로드캐스트 완료 카운트 증가 (원자적 증가를 위해 RPC 사용)
            const { error: incrementError } = await this.supabase
                .rpc('increment_broadcast_completed', {
                    p_broadcast_id: broadcastId
                });

            if (incrementError) {
                // RPC가 없으면 read-then-update 방식으로 폴백 (race condition 가능하지만 동작함)
                logger.warn('[Surfing:Record] increment RPC 미존재, 폴백 사용', { error: incrementError.message });
                
                const { data: broadcast } = await this.supabase
                    .from('pop_broadcasts')
                    .select('citizens_completed')
                    .eq('broadcast_id', broadcastId)
                    .single();

                await this.supabase
                    .from('pop_broadcasts')
                    .update({ 
                        citizens_completed: (broadcast?.citizens_completed || 0) + 1
                    })
                    .eq('broadcast_id', broadcastId);
            }

            logger.info('[Surfing:Record] 참여 기록 완료', { 
                citizenId, 
                existenceGained 
            });

            return {
                success: true,
                existence_gained: existenceGained,
                new_existence_score: newExistence
            };

        } catch (error) {
            logger.error('[Surfing:Record] 기록 실패', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    async _fetchVideoComments(videoId) {
        if (!this.youtubeApiKey) return [];

        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('videoId', videoId);
            url.searchParams.set('maxResults', SURFING_CONFIG.SAMPLE_COMMENTS_COUNT.toString());
            url.searchParams.set('order', 'relevance');
            url.searchParams.set('key', this.youtubeApiKey);

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok || !data.items) {
                return [];
            }

            return data.items.map(item => ({
                author: item.snippet.topLevelComment.snippet.authorDisplayName,
                text: item.snippet.topLevelComment.snippet.textDisplay,
                like_count: item.snippet.topLevelComment.snippet.likeCount,
                published_at: item.snippet.topLevelComment.snippet.publishedAt
            }));

        } catch (error) {
            logger.warn('[Surfing] 댓글 조회 실패', { videoId, error: error.message });
            return [];
        }
    }

    async _selectCitizensForPop(targetCount, priorityThreshold) {
        // 우선순위 기반 시민 선택
        // 낮은 existence_score = 높은 우선순위 (사회 참여 필요)
        const { data: citizens } = await this.supabase
            .from('citizens')
            .select('citizen_id, existence_score, extraversion, last_active_at')
            .in('status', ['IDLE', 'MINING'])
            .order('existence_score', { ascending: true })
            .order('last_active_at', { ascending: true })
            .order('extraversion', { ascending: false })
            .limit(targetCount);

        return (citizens || []).map((citizen, index) => ({
            ...citizen,
            priority: Math.min(priorityThreshold, Math.floor(index / 10) + 1)
        }));
    }

    _extractCommonPhrases(sampleComments) {
        if (!sampleComments || sampleComments.length === 0) {
            return ['ㅋㅋㅋ', '대박', '최고'];
        }

        const commonKoreanPhrases = [
            'ㅋㅋㅋ', 'ㅎㅎㅎ', '대박', '최고', '와', '진짜',
            '웃기다', '미쳤다', '레전드', '인정', '공감', '감동'
        ];

        const found = [];
        const allText = sampleComments.map(c => c.text).join(' ');

        for (const phrase of commonKoreanPhrases) {
            if (allText.includes(phrase)) {
                found.push(phrase);
            }
        }

        return found.length > 0 ? found.slice(0, 5) : ['ㅋㅋ', '최고'];
    }

    async _analyzeWithAI(comments) {
        const commentTexts = comments.slice(0, 10).join('\n');
        
        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `YouTube 댓글을 분석하여 다음 JSON 형식으로 응답하세요:
{
    "overall_sentiment": "positive" | "negative" | "neutral" | "mixed",
    "sentiment_score": -1.0 ~ 1.0,
    "dominant_emotions": ["감정1", "감정2"],
    "common_phrases": ["표현1", "표현2"],
    "tone": "casual" | "formal" | "aggressive" | "supportive"
}`
                },
                { role: 'user', content: commentTexts }
            ],
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: 'json_object' }
        });

        try {
            return JSON.parse(completion.choices[0]?.message?.content || '{}');
        } catch {
            return this._analyzeWithRules(comments);
        }
    }

    _analyzeWithRules(comments) {
        const positiveWords = ['좋', '최고', '대박', '웃', 'ㅋㅋ', 'ㅎㅎ', '감동', '사랑'];
        const negativeWords = ['별로', '싫', '못', '안돼', '쓰레기', '최악'];

        let positiveCount = 0;
        let negativeCount = 0;

        for (const comment of comments) {
            const text = typeof comment === 'string' ? comment : comment.text;
            for (const word of positiveWords) {
                if (text.includes(word)) positiveCount++;
            }
            for (const word of negativeWords) {
                if (text.includes(word)) negativeCount++;
            }
        }

        const total = positiveCount + negativeCount;
        let sentiment, score;

        if (total === 0) {
            sentiment = SENTIMENT_LABELS.NEUTRAL;
            score = 0;
        } else if (positiveCount > negativeCount * 2) {
            sentiment = SENTIMENT_LABELS.POSITIVE;
            score = Math.min(1, positiveCount / total);
        } else if (negativeCount > positiveCount * 2) {
            sentiment = SENTIMENT_LABELS.NEGATIVE;
            score = Math.max(-1, -negativeCount / total);
        } else {
            sentiment = SENTIMENT_LABELS.MIXED;
            score = (positiveCount - negativeCount) / total;
        }

        return {
            overall_sentiment: sentiment,
            sentiment_score: score,
            dominant_emotions: sentiment === SENTIMENT_LABELS.POSITIVE ? ['재미', '흥미'] : ['무관심'],
            common_phrases: this._extractCommonPhrases(comments),
            tone: 'casual'
        };
    }

    _generateTemplateConformComment(sentiment, commonPhrases, extraversion) {
        const templates = {
            positive: [
                'ㅋㅋㅋㅋ 진짜 웃기다',
                '와 대박 최고네',
                '인정합니다 ㅋㅋ',
                '역시 재밌어요!',
                '꿀잼 ㅋㅋㅋ'
            ],
            negative: [
                '음... 글쎄요',
                '개인적으론 별로였어요',
                '좀 아쉬웠네요'
            ],
            neutral: [
                '그렇구나',
                '오 신기하네',
                '잘 봤습니다'
            ],
            mixed: [
                '호불호 갈릴듯',
                '재밌긴 한데...',
                '뭔가 미묘하네 ㅋㅋ'
            ]
        };

        const pool = templates[sentiment] || templates.neutral;
        
        // 외향성이 높으면 더 적극적인 표현 선택
        let text;
        if (extraversion > 0.7 && commonPhrases.length > 0) {
            text = `${commonPhrases[0]} ${pool[0]}`;
        } else {
            text = pool[Math.floor(Math.random() * pool.length)];
        }

        return {
            text,
            conformityScore: 0.7 + (extraversion * 0.2)
        };
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

module.exports = SurfingService;

