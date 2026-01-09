/**
 * Health Router
 * 헬스체크 및 상태 조회
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * 기본 헬스체크
 */
router.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        version: '1.0.0'
    });
});

/**
 * 상세 상태
 */
router.get('/status', (req, res) => {
    const { deviceTracker, taskQueue } = req.context;

    const devices = deviceTracker.getAllDevices();
    const taskStats = taskQueue.getStats();

    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        devices: {
            total: devices.length,
            healthy: devices.filter(d => d.status === 'HEALTHY').length,
            byStatus: devices.reduce((acc, d) => {
                acc[d.status] = (acc[d.status] || 0) + 1;
                return acc;
            }, {})
        },
        tasks: taskStats,
        uptime: process.uptime()
    });
});

/**
 * 기기 목록
 */
router.get('/devices', (req, res) => {
    const { deviceTracker } = req.context;
    
    const devices = deviceTracker.getAllDevices().map(d => ({
        id: d.id,
        status: d.status,
        connectedAt: d.connectedAt,
        lastSeen: d.lastSeen,
        taskCount: d.taskCount,
        errorCount: d.errorCount
    }));

    res.json({ devices });
});

module.exports = router;

