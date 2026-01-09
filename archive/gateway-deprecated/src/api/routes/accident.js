/**
 * Accident API Routes
 * 🔥 Accident Activity (The Response) Endpoints
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/accident/dispatch
 * Admin: 위기 영상 등록
 */
router.post('/dispatch', async (req, res) => {
    const { logger, responseService } = req.context;
    const {
        video_url,
        headline,
        description,
        severity,
        accident_type,
        response_action,
        target_percentage,
        created_by = 'admin'
    } = req.body;

    try {
        // 필수 필드 검증
        if (!video_url || !headline || !description || !severity || 
            !accident_type || !response_action) {
            return res.status(400).json({
                success: false,
                error: 'video_url, headline, description, severity, accident_type, response_action required'
            });
        }

        // 1. 영상 정보 파싱
        const dispatchResult = await responseService.dispatchAccident({
            videoUrl: video_url,
            headline,
            description,
            severity,
            accidentType: accident_type,
            responseAction: response_action,
            targetPercentage: target_percentage,
            createdBy: created_by
        });

        if (!dispatchResult.success) {
            return res.status(400).json(dispatchResult);
        }

        // 2. 저장
        const storeResult = await responseService.storeAccident({
            videoId: dispatchResult._internal.videoId,
            headline: dispatchResult._internal.headline,
            description: dispatchResult._internal.description,
            severity: dispatchResult._internal.severity,
            accidentType: dispatchResult._internal.accidentType,
            responseAction: dispatchResult._internal.responseAction,
            targetPercentage: dispatchResult._internal.targetPercentage,
            createdBy: dispatchResult._internal.createdBy
        });

        res.json({
            success: true,
            accident_id: storeResult.accident_id,
            video_id: dispatchResult.video_id,
            parsed_video: dispatchResult.parsed_video,
            estimated_responders: dispatchResult.estimated_responders,
            priority_level: storeResult.priority_level
        });
    } catch (e) {
        logger.error('[AccidentAPI] Dispatch 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/accident/analyze
 * 위기 영상 분석
 */
router.post('/analyze', async (req, res) => {
    const { logger, responseService } = req.context;
    const { accident_id, video_id } = req.body;

    try {
        if (!accident_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'accident_id and video_id required'
            });
        }

        const result = await responseService.analyzeAccident(accident_id, video_id);
        res.json(result);
    } catch (e) {
        logger.error('[AccidentAPI] 분석 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/accident/interrupt
 * 모든 시민에게 인터럽트 발송
 */
router.post('/interrupt', async (req, res) => {
    const { logger, responseService, wsMultiplexer } = req.context;
    const { accident_id } = req.body;

    try {
        if (!accident_id) {
            return res.status(400).json({
                success: false,
                error: 'accident_id required'
            });
        }

        const result = await responseService.interruptAll(accident_id);

        if (result.success && wsMultiplexer && result.command) {
            // target_citizens이 배열인지 확인 후 처리
            const targetCitizens = Array.isArray(result.target_citizens) ? result.target_citizens : [];
            
            // WebSocket으로 모든 대상 시민에게 인터럽트 명령 전송
            for (const citizenId of targetCitizens) {
                wsMultiplexer.sendToDevice(citizenId, result.command);
            }
            
            logger.info('[AccidentAPI] 인터럽트 명령 브로드캐스트 완료', {
                accidentId: accident_id,
                citizenCount: targetCitizens.length
            });
        }

        res.json(result);
    } catch (e) {
        logger.error('[AccidentAPI] 인터럽트 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/accident/generate-response
 * 비판적 댓글 또는 신고 사유 생성
 */
router.post('/generate-response', async (req, res) => {
    const { logger, responseService } = req.context;
    const {
        citizen_id,
        accident_id,
        video_id,
        response_action,
        transcript_summary,
        threat_keywords,
        citizen_traits
    } = req.body;

    try {
        if (!citizen_id || !accident_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and accident_id required'
            });
        }

        const result = await responseService.generateResponse({
            citizenId: citizen_id,
            accidentId: accident_id,
            videoId: video_id,
            responseAction: response_action,
            transcriptSummary: transcript_summary,
            threatKeywords: threat_keywords,
            citizenTraits: citizen_traits
        });

        res.json(result);
    } catch (e) {
        logger.error('[AccidentAPI] 대응 생성 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/accident/log
 * 위기 대응 결과 기록
 */
router.post('/log', async (req, res) => {
    const { logger, responseService } = req.context;
    const {
        accident_id,
        citizen_id,
        interrupted_task,
        previous_state,
        response_action,
        watch_duration,
        critical_comment,
        comment_posted,
        reported,
        success,
        failure_reason
    } = req.body;

    try {
        if (!accident_id || !citizen_id) {
            return res.status(400).json({
                success: false,
                error: 'accident_id and citizen_id required'
            });
        }

        const result = await responseService.logResponse({
            accidentId: accident_id,
            citizenId: citizen_id,
            interruptedTask: interrupted_task,
            previousState: previous_state,
            responseAction: response_action,
            watchDuration: watch_duration,
            criticalComment: critical_comment,
            commentPosted: comment_posted,
            reported,
            success,
            failureReason: failure_reason
        });

        res.json(result);
    } catch (e) {
        logger.error('[AccidentAPI] 기록 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/accident/list
 * 위기 목록 조회
 */
router.get('/list', async (req, res) => {
    const { logger, supabase } = req.context;
    const { status, severity, limit = 20 } = req.query;

    try {
        // limit 파라미터 검증 및 정규화
        const DEFAULT_LIMIT = 20;
        const MAX_LIMIT = 100;
        const MIN_LIMIT = 1;
        
        let parsedLimit = parseInt(limit, 10);
        if (!Number.isFinite(parsedLimit) || parsedLimit < MIN_LIMIT) {
            parsedLimit = DEFAULT_LIMIT;
        } else if (parsedLimit > MAX_LIMIT) {
            parsedLimit = MAX_LIMIT;
        }

        let query = supabase
            .from('accidents')
            .select(`
                accident_id,
                video_id,
                headline,
                description,
                admin_severity,
                accident_type_value,
                response_action_value,
                status,
                citizens_notified,
                citizens_responded,
                defense_success,
                created_at,
                youtube_videos!inner (
                    title,
                    channel_name,
                    thumbnail_url
                )
            `)
            .order('created_at', { ascending: false })
            .limit(parsedLimit);

        if (status) {
            query = query.eq('status', status);
        }
        if (severity) {
            query = query.eq('admin_severity', severity);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            accidents: data || []
        });
    } catch (e) {
        logger.error('[AccidentAPI] 목록 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/accident/:accidentId
 * 위기 상세 조회
 */
router.get('/:accidentId', async (req, res) => {
    const { logger, supabase } = req.context;
    const { accidentId } = req.params;

    try {
        // 위기 정보
        const { data: accident, error: accidentError } = await supabase
            .from('accidents')
            .select(`
                *,
                youtube_videos!inner (*)
            `)
            .eq('accident_id', accidentId)
            .single();

        if (accidentError) throw accidentError;

        // 대응 로그
        const { data: logs, error: logsError } = await supabase
            .from('accident_logs')
            .select(`
                log_id,
                citizen_id,
                response_action,
                success,
                existence_change,
                credits_change,
                completed_at
            `)
            .eq('accident_id', accidentId)
            .order('completed_at', { ascending: false });

        if (logsError) {
            logger.error('[AccidentAPI] 대응 로그 조회 오류', { error: logsError.message });
            // 로그 조회 실패 시 빈 배열로 진행 (accident 정보는 반환)
        }

        res.json({
            success: true,
            accident,
            logs: logs || []
        });
    } catch (e) {
        logger.error('[AccidentAPI] 상세 조회 오류', { error: e.message });
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;

