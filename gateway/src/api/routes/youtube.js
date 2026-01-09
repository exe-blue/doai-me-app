/**
 * YouTube API Router
 * YouTube URL 파싱 및 메타데이터 조회
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 2.1
 */

const express = require('express');
const router = express.Router();
const YouTubeParser = require('../../services/youtube/YouTubeParser');
const logger = require('../../utils/logger');

// YouTubeParser 인스턴스
const youtubeParser = new YouTubeParser({
    apiKey: process.env.YOUTUBE_API_KEY
});

/**
 * POST /api/youtube/parse
 * YouTube URL 파싱 및 메타데이터 조회
 * 
 * Request Body:
 * {
 *   "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 * }
 * 
 * Response (Success):
 * {
 *   "success": true,
 *   "data": {
 *     "video_id": "dQw4w9WgXcQ",
 *     "title": "Rick Astley - Never Gonna Give You Up",
 *     "duration_seconds": 213,
 *     "channel_name": "Rick Astley",
 *     "thumbnail_url": "..."
 *   }
 * }
 */
router.post('/parse', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_URL',
                message: 'YouTube URL is required'
            });
        }

        const result = await youtubeParser.parse(url);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        // Duration 포맷 추가
        result.data.duration_formatted = youtubeParser.formatDuration(result.data.duration_seconds);

        res.json({
            success: true,
            data: result.data
        });

    } catch (error) {
        logger.error('[YouTube API] POST /parse failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'API_ERROR',
            message: 'Failed to parse YouTube URL'
        });
    }
});

/**
 * GET /api/youtube/video/:videoId
 * Video ID로 직접 메타데이터 조회
 */
router.get('/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;

        const result = await youtubeParser.parseById(videoId);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
                message: result.message
            });
        }

        result.data.duration_formatted = youtubeParser.formatDuration(result.data.duration_seconds);

        res.json({
            success: true,
            data: result.data
        });

    } catch (error) {
        logger.error('[YouTube API] GET /video/:videoId failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'API_ERROR',
            message: 'Failed to fetch video info'
        });
    }
});

/**
 * GET /api/youtube/thumbnail/:videoId
 * Video ID로 썸네일 URL 조회
 */
router.get('/thumbnail/:videoId', (req, res) => {
    const { videoId } = req.params;
    const { quality = 'medium' } = req.query;

    if (!youtubeParser.isValidVideoId(videoId)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_VIDEO_ID',
            message: 'Invalid video ID format'
        });
    }

    const thumbnailUrl = youtubeParser.getThumbnailUrl(videoId, quality);

    res.json({
        success: true,
        data: {
            video_id: videoId,
            quality,
            thumbnail_url: thumbnailUrl
        }
    });
});

/**
 * POST /api/youtube/validate
 * 여러 URL 일괄 검증
 */
router.post('/validate', async (req, res) => {
    try {
        const { urls } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_INPUT',
                message: 'urls must be a non-empty array'
            });
        }

        // 최대 10개 제한
        const limitedUrls = urls.slice(0, 10);

        const results = await Promise.all(
            limitedUrls.map(async (url) => {
                const videoId = youtubeParser.extractVideoId(url);
                return {
                    url,
                    valid: !!videoId,
                    video_id: videoId
                };
            })
        );

        res.json({
            success: true,
            data: results,
            total: results.length,
            validCount: results.filter(r => r.valid).length
        });

    } catch (error) {
        logger.error('[YouTube API] POST /validate failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'API_ERROR',
            message: 'Failed to validate URLs'
        });
    }
});

module.exports = router;

