/**
 * Kernel API Router
 * YouTube 자동화를 위한 Kernel 엔드포인트
 *
 * YouTube App 자동화를 통한 실제 YouTube 액션 실행
 * - 좋아요 (like)
 * - 댓글 (comment)
 * - 구독 (subscribe)
 *
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const Logger = require('../../utils/logger');

const logger = new Logger();

// Dependencies (initialized via initKernelRouter)
let deviceTracker = null;
let laixiAdapter = null;

/**
 * UI Coordinates for YouTube App (1080x1920 base resolution)
 * From YouTubeController.js
 */
const UI_COORDS = {
    LIKE_BUTTON: { x: 116, y: 1330 },
    COMMENT_BUTTON: { x: 312, y: 1330 },
    COMMENT_INPUT: { x: 540, y: 1800 },
    COMMENT_SEND: { x: 1000, y: 1800 },
    SUBSCRIBE_BUTTON: { x: 900, y: 750 },
};

/**
 * Initialize Kernel Router with dependencies
 * Called from index.js after LaixiAdapter is created
 */
function initKernelRouter(tracker, laixi) {
    deviceTracker = tracker;
    laixiAdapter = laixi;
    logger.info('[Kernel] Router initialized with YouTube app automation');
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET /api/kernel/youtube
 * Kernel 설정 상태 확인
 */
router.get('/youtube', (req, res) => {
    const kernelConfigured = !!process.env.KERNEL_API_KEY;
    const laixiConnected = laixiAdapter?.isConnected || false;
    const deviceCount = deviceTracker ? deviceTracker.getHealthyDevices().length : 0;

    res.json({
        kernelConfigured,
        laixiConnected,
        availableDevices: deviceCount
    });
});

/**
 * POST /api/kernel/youtube
 * YouTube 자동화 실행 (like, comment, subscribe)
 *
 * Request Body:
 * {
 *   "action": "like" | "comment" | "subscribe",
 *   "videoId": "dQw4w9WgXcQ",
 *   "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
 *   "comment": "Great video!" (optional, for comment action)
 * }
 */
router.post('/youtube', async (req, res) => {
    const { action, videoId, channelId, comment } = req.body;
    const startTime = Date.now();

    // 1. Check if Kernel is configured
    if (!process.env.KERNEL_API_KEY) {
        return res.json({
            success: false,
            error: 'KERNEL_NOT_CONFIGURED',
            data: { error: 'Kernel API key not configured' }
        });
    }

    // 2. Check if LaixiAdapter is available
    if (!laixiAdapter || !deviceTracker) {
        logger.warn('[Kernel] LaixiAdapter not initialized, falling back to simulation');
        const totalDuration = Date.now() - startTime;
        return res.json({
            success: false,
            simulated: true,
            totalDuration,
            message: `${action} action simulated (Laixi not connected)`
        });
    }

    // 3. Check if Laixi is connected
    if (!laixiAdapter.isConnected) {
        logger.warn('[Kernel] Laixi not connected, falling back to simulation');
        const totalDuration = Date.now() - startTime;
        return res.json({
            success: false,
            simulated: true,
            totalDuration,
            message: `${action} action simulated (Laixi disconnected)`
        });
    }

    // 4. Get available healthy devices
    const devices = deviceTracker.getHealthyDevices();
    if (devices.length === 0) {
        return res.json({
            success: false,
            error: 'NO_DEVICES_AVAILABLE',
            data: { error: 'No healthy devices available for automation' }
        });
    }

    // 5. Select random device (DeviceTracker uses 'id' property)
    const device = devices[Math.floor(Math.random() * devices.length)];
    const serial = device.id;

    logger.info(`[Kernel] YouTube ${action} requested`, {
        action,
        videoId,
        channelId,
        comment: comment ? comment.substring(0, 20) : undefined,
        device: serial
    });

    try {
        // 6. Open video in YouTube app (if videoId provided)
        if (videoId) {
            logger.info(`[Kernel] Opening video ${videoId} in YouTube app...`);
            // Use YouTube deep link to open in YouTube app
            await laixiAdapter.openUrl(serial, `vnd.youtube:${videoId}`);
            await sleep(5000); // Wait for video load
        }

        // 7. Execute action
        let result = { success: true };

        switch (action) {
            case 'like':
                logger.info('[Kernel] Executing like action...');
                await laixiAdapter.tap(serial, UI_COORDS.LIKE_BUTTON.x, UI_COORDS.LIKE_BUTTON.y);
                result.action = 'like';
                break;

            case 'comment':
                if (!comment) {
                    return res.json({
                        success: false,
                        error: 'MISSING_COMMENT',
                        data: { error: 'Comment text is required for comment action' }
                    });
                }
                logger.info('[Kernel] Executing comment action...');

                // Tap comment area
                await laixiAdapter.tap(serial, UI_COORDS.COMMENT_BUTTON.x, UI_COORDS.COMMENT_BUTTON.y);
                await sleep(1500);

                // Tap input field
                await laixiAdapter.tap(serial, UI_COORDS.COMMENT_INPUT.x, UI_COORDS.COMMENT_INPUT.y);
                await sleep(500);

                // Set clipboard and paste (for Korean text support)
                await laixiAdapter.setClipboard(serial, comment);
                await sleep(300);
                await laixiAdapter.paste(serial);
                await sleep(500);

                // Send comment
                await laixiAdapter.tap(serial, UI_COORDS.COMMENT_SEND.x, UI_COORDS.COMMENT_SEND.y);
                result.action = 'comment';
                result.commentText = comment;
                break;

            case 'subscribe':
                logger.info('[Kernel] Executing subscribe action...');
                await laixiAdapter.tap(serial, UI_COORDS.SUBSCRIBE_BUTTON.x, UI_COORDS.SUBSCRIBE_BUTTON.y);
                result.action = 'subscribe';
                break;

            default:
                return res.json({
                    success: false,
                    error: 'INVALID_ACTION',
                    data: { error: `Unknown action: ${action}` }
                });
        }

        const totalDuration = Date.now() - startTime;

        logger.info(`[Kernel] ${action} completed`, {
            success: true,
            duration: totalDuration,
            device: serial
        });

        res.json({
            success: true,
            totalDuration,
            device: serial,
            action,
            result
        });

    } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(`[Kernel] YouTube ${action} failed`, {
            error: error.message,
            serial,
            duration: totalDuration
        });

        res.json({
            success: false,
            error: error.message,
            device: serial,
            totalDuration,
            data: { error: error.message }
        });
    }
});

module.exports = router;
module.exports.initKernelRouter = initKernelRouter;
