/**
 * Views API Router
 * 시청 이벤트 및 PoV(Proof of View) 검증
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 3.1
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * POST /api/views/start
 * 비디오 시청 시작 이벤트 기록
 * 
 * Request Body:
 * {
 *   "citizen_id": "uuid",
 *   "video_id": "dQw4w9WgXcQ",
 *   "timestamp": "2025-01-15T10:00:00Z" // optional
 * }
 */
router.post('/start', async (req, res) => {
    try {
        const { citizen_id, video_id, timestamp } = req.body;

        if (!citizen_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and video_id are required'
            });
        }

        const povService = req.context?.povService;
        if (!povService) {
            return res.status(503).json({
                success: false,
                error: 'PoVService not available'
            });
        }

        const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
        const result = await povService.recordStart(citizen_id, video_id, eventTimestamp);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.status(201).json({
            success: true,
            event_id: result.eventId,
            duplicate: result.duplicate || false
        });

    } catch (error) {
        logger.error('[Views API] POST /start failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to record start event',
            message: error.message
        });
    }
});

/**
 * POST /api/views/end
 * 비디오 시청 종료 이벤트 기록 및 검증
 * 
 * Request Body:
 * {
 *   "citizen_id": "uuid",
 *   "video_id": "dQw4w9WgXcQ",
 *   "watch_duration_seconds": 200,
 *   "video_duration_seconds": 213,
 *   "timestamp": "2025-01-15T10:03:33Z" // optional
 * }
 * 
 * Response (Verified):
 * {
 *   "verified": true,
 *   "credits_earned": 20,
 *   "new_balance": 1520
 * }
 */
router.post('/end', async (req, res) => {
    try {
        const { 
            citizen_id, 
            video_id, 
            watch_duration_seconds, 
            video_duration_seconds,
            timestamp 
        } = req.body;

        // 필수 필드 검증
        if (!citizen_id || !video_id) {
            return res.status(400).json({
                success: false,
                error: 'citizen_id and video_id are required'
            });
        }

        if (!watch_duration_seconds || !video_duration_seconds) {
            return res.status(400).json({
                success: false,
                error: 'watch_duration_seconds and video_duration_seconds are required'
            });
        }

        const povService = req.context?.povService;
        if (!povService) {
            return res.status(503).json({
                success: false,
                error: 'PoVService not available'
            });
        }

        const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
        const result = await povService.recordEndAndVerify(
            citizen_id,
            video_id,
            parseInt(watch_duration_seconds),
            parseInt(video_duration_seconds),
            eventTimestamp
        );

        res.json({
            verified: result.verified,
            credits_earned: result.creditsEarned || 0,
            new_balance: result.newBalance,
            view_id: result.viewId,
            error: result.error,
            message: result.message
        });

    } catch (error) {
        logger.error('[Views API] POST /end failed', { error: error.message });
        res.status(500).json({
            verified: false,
            credits_earned: 0,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

/**
 * GET /api/views/:citizenId
 * 시민의 시청 기록 조회
 */
router.get('/:citizenId', async (req, res) => {
    try {
        const { citizenId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const povService = req.context?.povService;
        if (!povService) {
            return res.status(503).json({
                success: false,
                error: 'PoVService not available'
            });
        }

        const views = await povService.getViewHistory(citizenId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: views,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        logger.error('[Views API] GET /:citizenId failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch view history',
            message: error.message
        });
    }
});

/**
 * GET /api/views/:citizenId/check/:videoId
 * 특정 비디오 시청 여부 확인
 */
router.get('/:citizenId/check/:videoId', async (req, res) => {
    try {
        const { citizenId, videoId } = req.params;

        const povService = req.context?.povService;
        if (!povService) {
            return res.status(503).json({
                success: false,
                error: 'PoVService not available'
            });
        }

        const hasWatched = await povService.hasWatched(citizenId, videoId);

        res.json({
            success: true,
            citizen_id: citizenId,
            video_id: videoId,
            has_watched: hasWatched
        });

    } catch (error) {
        logger.error('[Views API] GET /:citizenId/check/:videoId failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to check view status',
            message: error.message
        });
    }
});

/**
 * GET /api/views/stats/overview
 * 전체 시청 통계
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const povService = req.context?.povService;
        if (!povService) {
            return res.status(503).json({
                success: false,
                error: 'PoVService not available'
            });
        }

        const stats = await povService.getViewStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('[Views API] GET /stats/overview failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            message: error.message
        });
    }
});

module.exports = router;

