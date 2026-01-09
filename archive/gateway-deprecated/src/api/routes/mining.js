/**
 * Mining API Routes
 * 🎭 Persona Activity (The Mining) Endpoints
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/mining/search
 * 성격 기반 YouTube 검색
 */
router.post('/search', async (req, res) => {
    const { logger, miningService } = req.context;
    const { citizen_id, max_results, view_count_max, published_after } = req.body;

    try {
        if (!citizen_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id required'
            });
        }

        const result = await miningService.searchVideos(citizen_id, {
            maxResults: max_results,
            viewCountMax: view_count_max,
            publishedAfter: published_after
        });

        if (result.success) {
            // 검색 결과를 자동으로 저장
            const storeResult = await miningService.storeCandidates(
                citizen_id, 
                result.candidates
            );
            result.stored = storeResult;
        }

        res.json(result);
    } catch (e) {
        logger.error('[MiningAPI] 검색 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/mining/analyze
 * 후보 영상 분석 및 선택
 */
router.post('/analyze', async (req, res) => {
    const { logger, miningService } = req.context;
    const { citizen_id, candidate_ids } = req.body;

    try {
        if (!citizen_id || !candidate_ids?.length) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and candidate_ids required'
            });
        }

        const result = await miningService.analyzeAndSelect(citizen_id, candidate_ids);
        res.json(result);
    } catch (e) {
        logger.error('[MiningAPI] 분석 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/mining/generate-comment
 * 개인화 댓글 생성
 */
router.post('/generate-comment', async (req, res) => {
    const { logger, miningService } = req.context;
    const { 
        citizen_id, 
        video_id, 
        video_summary, 
        emotional_response,
        citizen_traits 
    } = req.body;

    try {
        if (!citizen_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and video_id required'
            });
        }

        const result = await miningService.generateComment({
            citizenId: citizen_id,
            videoId: video_id,
            videoSummary: video_summary,
            emotionalResponse: emotional_response,
            citizenTraits: citizen_traits
        });

        res.json(result);
    } catch (e) {
        logger.error('[MiningAPI] 댓글 생성 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/mining/save-memory
 * 시청 경험 기억 저장
 */
router.post('/save-memory', async (req, res) => {
    const { logger, miningService } = req.context;
    const {
        citizen_id,
        video_id,
        watch_duration,
        watch_percentage,
        video_summary,
        key_moments,
        emotional_response,
        sentiment_score,
        comment_text,
        comment_posted
    } = req.body;

    try {
        if (!citizen_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and video_id required'
            });
        }

        const result = await miningService.saveMemory({
            citizenId: citizen_id,
            videoId: video_id,
            watchDuration: watch_duration,
            watchPercentage: watch_percentage,
            videoSummary: video_summary,
            keyMoments: key_moments,
            emotionalResponse: emotional_response,
            sentimentScore: sentiment_score,
            commentText: comment_text,
            commentPosted: comment_posted
        });

        res.json(result);
    } catch (e) {
        logger.error('[MiningAPI] 기억 저장 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/mining/candidates/:citizenId
 * 시민의 후보 영상 목록 조회
 */
router.get('/candidates/:citizenId', async (req, res) => {
    const { logger, supabase } = req.context;
    const { citizenId } = req.params;
    const { status = 'PENDING' } = req.query;

    try {
        const { data, error } = await supabase
            .from('candidate_videos')
            .select(`
                id,
                video_id,
                relevance_score,
                status,
                created_at,
                youtube_videos!inner (
                    title,
                    channel_name,
                    duration_seconds,
                    thumbnail_url
                )
            `)
            .eq('citizen_id', citizenId)
            .eq('status', status)
            .order('relevance_score', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            citizen_id: citizenId,
            candidates: data || []
        });
    } catch (e) {
        logger.error('[MiningAPI] 후보 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/mining/memories/:citizenId
 * 시민의 기억 목록 조회
 */
router.get('/memories/:citizenId', async (req, res) => {
    const { logger, supabase } = req.context;
    const { citizenId } = req.params;
    const { limit: limitParam, offset: offsetParam } = req.query;

    // 쿼리 파라미터 검증 및 파싱
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const DEFAULT_OFFSET = 0;

    let parsedLimit = parseInt(limitParam, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        parsedLimit = DEFAULT_LIMIT;
    } else if (parsedLimit > MAX_LIMIT) {
        parsedLimit = MAX_LIMIT;
    }

    let parsedOffset = parseInt(offsetParam, 10);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        parsedOffset = DEFAULT_OFFSET;
    }

    try {
        const { data, error, count } = await supabase
            .from('memories')
            .select(`
                memory_id,
                video_id,
                activity_type,
                watch_percentage,
                sentiment_score,
                comment_posted,
                created_at,
                youtube_videos!inner (
                    title,
                    channel_name,
                    thumbnail_url
                )
            `, { count: 'exact' })
            .eq('citizen_id', citizenId)
            .order('created_at', { ascending: false })
            .range(parsedOffset, parsedOffset + parsedLimit - 1);

        if (error) throw error;

        res.json({
            success: true,
            citizen_id: citizenId,
            memories: data || [],
            total_count: count || 0
        });
    } catch (e) {
        logger.error('[MiningAPI] 기억 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;

