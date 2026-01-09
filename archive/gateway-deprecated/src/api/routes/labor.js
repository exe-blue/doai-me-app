/**
 * Labor API Routes
 * 💰 Economy Activity (The Labor) Endpoints
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/labor/commissions
 * 열린 의뢰 목록 조회
 */
router.get('/commissions', async (req, res) => {
    const { logger, laborService } = req.context;
    const { status = 'OPEN', priority, limit = 20 } = req.query;

    try {
        const result = await laborService.getCommissions({
            status,
            priority: priority ? parseInt(priority) : undefined,
            limit: parseInt(limit)
        });

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 의뢰 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/labor/commissions
 * Admin: 새 의뢰 생성
 * ⚠️ 인증/인가 필요
 */
router.post('/commissions', async (req, res) => {
    const { logger, laborService } = req.context;
    
    // 관리자 권한 확인
    const user = req.context?.user || req.user;
    if (!user) {
        logger.warn('[LaborAPI] 인증되지 않은 의뢰 생성 시도');
        return res.status(401).json({
            success: false,
            error: '인증이 필요합니다'
        });
    }
    
    const isAdmin = user.role === 'admin' || user.is_admin === true;
    if (!isAdmin) {
        logger.warn('[LaborAPI] 권한 없는 의뢰 생성 시도', { userId: user.id });
        return res.status(403).json({
            success: false,
            error: '관리자 권한이 필요합니다'
        });
    }
    
    const {
        video_url,
        title,
        commission_type = 'WATCH_FULL',
        priority = 3,
        credits_reward,
        target_count = 1,
        expires_at,
        created_by = 'admin',
        memo
    } = req.body;

    try {
        if (!video_url || !title || !credits_reward) {
            return res.status(400).json({
                success: false,
                error: 'video_url, title, and credits_reward required'
            });
        }

        const result = await laborService.createCommission({
            videoUrl: video_url,
            title,
            commissionType: commission_type,
            priority,
            creditsReward: credits_reward,
            targetCount: target_count,
            expiresAt: expires_at,
            createdBy: created_by,
            memo
        });

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 의뢰 생성 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/labor/assign
 * 의뢰 배정
 */
router.post('/assign', async (req, res) => {
    const { logger, laborService, wsMultiplexer } = req.context;
    const { commission_id, citizen_id } = req.body;

    try {
        if (!commission_id || !citizen_id) {
            return res.status(400).json({
                success: false,
                error: 'commission_id and citizen_id required'
            });
        }

        const result = await laborService.assignCommission(commission_id, citizen_id);

        if (result.success && wsMultiplexer) {
            // WebSocket으로 시민에게 시청 명령 전송
            const command = laborService.generateWatchCommand(
                result.assignment_id,
                commission_id,
                result.commission.video_id,
                {
                    videoDuration: result.commission.video_duration,
                    screenshotTimestamps: result.instructions.screenshot_intervals
                }
            );

            wsMultiplexer.sendToDevice(citizen_id, command);
        }

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 의뢰 배정 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/labor/proof
 * 시청 증명 제출
 */
router.post('/proof', async (req, res) => {
    const { logger, laborService } = req.context;
    const {
        assignment_id,
        commission_id,
        video_id,
        citizen_id,
        start_event,
        end_event,
        video_duration,
        watch_duration,
        screenshots,
        timeline_events,
        final_timestamp
    } = req.body;

    try {
        if (!assignment_id || !citizen_id) {
            return res.status(400).json({
                success: false,
                error: 'assignment_id and citizen_id required'
            });
        }

        const result = await laborService.submitProof({
            assignmentId: assignment_id,
            commissionId: commission_id,
            videoId: video_id,
            citizenId: citizen_id,
            startEvent: start_event,
            endEvent: end_event,
            videoDuration: video_duration,
            watchDuration: watch_duration,
            screenshots,
            timelineEvents: timeline_events,
            finalTimestamp: final_timestamp
        });

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 증명 제출 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/labor/verify
 * 시청 증명 검증
 */
router.post('/verify', async (req, res) => {
    const { logger, laborService } = req.context;
    const { proof_id, assignment_id } = req.body;

    try {
        if (!proof_id || !assignment_id) {
            return res.status(400).json({
                success: false,
                error: 'proof_id and assignment_id required'
            });
        }

        const result = await laborService.verifyProof(proof_id, assignment_id);
        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 검증 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/labor/reward
 * 크레딧 보상 지급
 */
router.post('/reward', async (req, res) => {
    const { logger, laborService } = req.context;
    const { assignment_id, proof_id, verification_passed } = req.body;

    try {
        if (!assignment_id || !proof_id) {
            return res.status(400).json({
                success: false,
                error: 'assignment_id and proof_id required'
            });
        }

        const result = await laborService.reward({
            assignmentId: assignment_id,
            proofId: proof_id,
            verificationPassed: verification_passed
        });

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 보상 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/labor/history/:citizenId
 * 시민의 크레딧 거래 내역
 */
router.get('/history/:citizenId', async (req, res) => {
    const { logger, laborService } = req.context;
    const { citizenId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    try {
        const result = await laborService.getCreditHistory(citizenId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(result);
    } catch (e) {
        logger.error('[LaborAPI] 거래 내역 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/labor/assignments/:citizenId
 * 시민의 의뢰 배정 목록
 */
router.get('/assignments/:citizenId', async (req, res) => {
    const { logger, supabase } = req.context;
    const { citizenId } = req.params;
    const { status, limit = 20 } = req.query;

    try {
        let query = supabase
            .from('commission_assignments')
            .select(`
                assignment_id,
                status,
                verified,
                credits_earned,
                assigned_at,
                completed_at,
                commissions!inner (
                    commission_id,
                    title,
                    credits_reward,
                    youtube_videos!inner (
                        title,
                        thumbnail_url
                    )
                )
            `)
            .eq('citizen_id', citizenId)
            .order('assigned_at', { ascending: false })
            .limit(parseInt(limit));

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            citizen_id: citizenId,
            assignments: data || []
        });
    } catch (e) {
        logger.error('[LaborAPI] 배정 목록 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/labor/leaderboard
 * 크레딧 리더보드
 */
router.get('/leaderboard', async (req, res) => {
    const { logger, supabase } = req.context;
    const { limit = 10 } = req.query;

    try {
        const { data, error } = await supabase
            .from('citizens')
            .select('citizen_id, name, credits, existence_score')
            .order('credits', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;

        res.json({
            success: true,
            leaderboard: (data || []).map((citizen, index) => ({
                rank: index + 1,
                ...citizen
            }))
        });
    } catch (e) {
        logger.error('[LaborAPI] 리더보드 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;

