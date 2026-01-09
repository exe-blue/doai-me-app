/**
 * POP API Routes
 * 🍿 POP Activity (The Surfing) Endpoints
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/pop/trending
 * 트렌딩 영상 조회
 */
router.get('/trending', async (req, res) => {
    const { logger, surfingService } = req.context;
    const { region_code = 'KR', max_results = 20, category_id } = req.query;

    try {
        const result = await surfingService.fetchTrending({
            regionCode: region_code,
            maxResults: parseInt(max_results),
            categoryId: category_id
        });

        if (result.success) {
            // 자동으로 저장
            await surfingService.storeTrending(result.videos, region_code);
        }

        res.json(result);
    } catch (e) {
        logger.error('[POPAPI] 트렌딩 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/pop/current
 * 현재 활성화된 트렌딩 영상 조회 (캐시)
 */
router.get('/current', async (req, res) => {
    const { logger, supabase } = req.context;
    const { region_code = 'KR' } = req.query;

    try {
        const { data, error } = await supabase
            .from('current_trending')
            .select('*')
            .eq('region_code', region_code)
            .order('trending_rank', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            region_code,
            trending: data || []
        });
    } catch (e) {
        logger.error('[POPAPI] 현재 트렌딩 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/pop/analyze-comments
 * 댓글 감정 분석
 */
router.post('/analyze-comments', async (req, res) => {
    const { logger, surfingService } = req.context;
    const { video_id, sample_comments } = req.body;

    try {
        if (!video_id) {
            return res.status(400).json({
                success: false,
                error: 'video_id required'
            });
        }

        const result = await surfingService.analyzeComments(video_id, sample_comments);
        res.json(result);
    } catch (e) {
        logger.error('[POPAPI] 댓글 분석 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/pop/broadcast
 * POP 브로드캐스트 발송
 */
router.post('/broadcast', async (req, res) => {
    const { logger, surfingService, wsMultiplexer } = req.context;
    const { video_id, target_count = 50, priority_threshold = 3 } = req.body;

    try {
        if (!video_id) {
            return res.status(400).json({
                success: false,
                error: 'video_id required'
            });
        }

        const result = await surfingService.broadcast({
            videoId: video_id,
            targetCount: target_count,
            priorityThreshold: priority_threshold
        });

        if (result.success && wsMultiplexer) {
            // WebSocket으로 대상 시민들에게 명령 전송
            const command = surfingService.generateWatchCommand(
                result.broadcast_id,
                video_id,
                {
                    trendingRank: result.trending_rank,
                    commentSentiment: result.comment_sentiment,
                    commonPhrases: result.common_phrases
                }
            );

            // targeted_citizens이 배열인지 확인 후 처리
            if (Array.isArray(result.targeted_citizens) && result.targeted_citizens.length > 0) {
                for (const citizenId of result.targeted_citizens) {
                    wsMultiplexer.sendToDevice(citizenId, command);
                }
            } else {
                logger.info('[POPAPI] 대상 시민 없음 - 브로드캐스트 스킵', {
                    broadcastId: result.broadcast_id
                });
            }
        }

        res.json(result);
    } catch (e) {
        logger.error('[POPAPI] 브로드캐스트 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/pop/generate-conform-comment
 * 동조 댓글 생성
 */
router.post('/generate-conform-comment', async (req, res) => {
    const { logger, surfingService } = req.context;
    const {
        citizen_id,
        video_id,
        comment_sentiment,
        common_phrases,
        citizen_extraversion,
        citizen_agreeableness
    } = req.body;

    try {
        if (!citizen_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and video_id required'
            });
        }

        const result = await surfingService.generateConformComment({
            citizenId: citizen_id,
            videoId: video_id,
            commentSentiment: comment_sentiment,
            commonPhrases: common_phrases || [],
            citizenExtraversion: citizen_extraversion || 0.5,
            citizenAgreeableness: citizen_agreeableness || 0.5
        });

        res.json(result);
    } catch (e) {
        logger.error('[POPAPI] 동조 댓글 생성 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/pop/record-participation
 * POP 참여 기록
 */
router.post('/record-participation', async (req, res) => {
    const { logger, surfingService } = req.context;
    const {
        citizen_id,
        broadcast_id,
        video_id,
        trending_id,
        priority_at_time,
        watch_duration,
        analyzed_sentiment,
        generated_comment,
        comment_posted
    } = req.body;

    try {
        if (!citizen_id || !video_id || !trending_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id, video_id, and trending_id required'
            });
        }

        const result = await surfingService.recordParticipation({
            citizenId: citizen_id,
            broadcastId: broadcast_id,
            videoId: video_id,
            trendingId: trending_id,
            priorityAtTime: priority_at_time,
            watchDuration: watch_duration,
            analyzedSentiment: analyzed_sentiment,
            generatedComment: generated_comment,
            commentPosted: comment_posted
        });

        res.json(result);
    } catch (e) {
        logger.error('[POPAPI] 참여 기록 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/pop/broadcasts
 * 브로드캐스트 목록 조회
 */
router.get('/broadcasts', async (req, res) => {
    const { logger, supabase } = req.context;
    const { status, limit = 20 } = req.query;

    try {
        let query = supabase
            .from('pop_broadcasts')
            .select(`
                *,
                youtube_videos!inner (
                    title,
                    channel_name,
                    thumbnail_url
                )
            `)
            .order('started_at', { ascending: false })
            .limit(parseInt(limit));

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            broadcasts: data || []
        });
    } catch (e) {
        logger.error('[POPAPI] 브로드캐스트 목록 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;

