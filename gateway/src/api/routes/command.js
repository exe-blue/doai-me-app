/**
 * Command Router
 * 명령 전송 API
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * 작업 전송
 * POST /api/v1/command/task
 */
router.post('/task', async (req, res) => {
    const { logger, dispatcher } = req.context;

    try {
        const task = req.body;

        if (!task.type || !task.payload) {
            return res.status(400).json({ 
                error: 'type and payload required' 
            });
        }

        const taskId = await dispatcher.dispatchImmediate(task);

        logger.info('[API] 작업 요청', { taskId, type: task.type });

        res.json({
            success: true,
            task_id: taskId
        });

    } catch (e) {
        logger.error('[API] 작업 전송 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * POP 전송 (단축)
 * POST /api/v1/command/pop
 */
router.post('/pop', async (req, res) => {
    const { logger, dispatcher } = req.context;

    try {
        const { url, platform, tier, target_device_id } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'url required' });
        }

        const task = {
            type: 'POP',
            priority: 3,
            payload: {
                action: 'WATCH',
                content: {
                    platform: platform || 'youtube',
                    url,
                    duration_sec: 180
                },
                tier: tier || { level: 2 },
                return_behavior: {
                    on_complete: 'IDLE',
                    reaction_required: true,
                    min_watch_ratio: 0.7
                },
                target_device_id
            }
        };

        const taskId = await dispatcher.dispatchImmediate(task);

        logger.info('[API] POP 요청', { taskId, url });

        res.json({
            success: true,
            task_id: taskId
        });

    } catch (e) {
        logger.error('[API] POP 전송 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * ACCIDENT 전송 (단축)
 * POST /api/v1/command/accident
 */
router.post('/accident', async (req, res) => {
    const { logger, dispatcher, deviceTracker } = req.context;

    try {
        const { title, description, severity, affected_citizens } = req.body;

        const task = {
            type: 'ACCIDENT',
            priority: 4, // URGENT
            payload: {
                severity: severity || 'MODERATE',
                category: 'SOCIAL',
                event: {
                    id: require('uuid').v4(),
                    title: title || '긴급 상황 발생',
                    description,
                    affected_citizens: affected_citizens || [],
                    started_at: Date.now()
                },
                alert: {
                    level: severity === 'CATASTROPHIC' ? 4 : 2,
                    visual_effect: 'FULLSCREEN',
                    duration_sec: 10
                },
                response_window: {
                    deadline_ts: Date.now() + 120000, // 2분
                    available_actions: ['ACKNOWLEDGE', 'ASSIST', 'IGNORE'],
                    reward_on_assist: 50,
                    penalty_on_ignore: -10
                }
            }
        };

        // 모든 기기에 전송
        const devices = deviceTracker.getHealthyDevices();
        const taskIds = [];

        for (const device of devices) {
            const deviceTask = { ...task };
            deviceTask.payload.target_device_id = device.id;
            const taskId = await dispatcher.dispatchImmediate(deviceTask);
            taskIds.push(taskId);
        }

        logger.warn('[API] ACCIDENT 전송', { 
            title, 
            devices: devices.length 
        });

        res.json({
            success: true,
            task_ids: taskIds,
            devices_notified: devices.length
        });

    } catch (e) {
        logger.error('[API] ACCIDENT 전송 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * SYSTEM 명령 전송
 * POST /api/v1/command/system
 */
router.post('/system', async (req, res) => {
    const { logger, commander } = req.context;

    try {
        const { device_id, command, payload } = req.body;

        if (!device_id || !command) {
            return res.status(400).json({ 
                error: 'device_id and command required' 
            });
        }

        const success = await commander.sendSystem(device_id, command, payload);

        logger.info('[API] SYSTEM 명령', { device_id, command, success });

        res.json({ success });

    } catch (e) {
        logger.error('[API] SYSTEM 전송 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

/**
 * Zombie Mode 실행
 * POST /api/v1/command/recovery
 */
router.post('/recovery', async (req, res) => {
    const { logger, recovery } = req.context;

    try {
        const { device_id } = req.body;

        if (!device_id) {
            return res.status(400).json({ error: 'device_id required' });
        }

        recovery.scheduleRecovery(device_id);

        logger.info('[API] 복구 요청', { device_id });

        res.json({
            success: true,
            message: 'Recovery scheduled'
        });

    } catch (e) {
        logger.error('[API] 복구 요청 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

