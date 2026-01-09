/**
 * Response Router
 * 클라이언트 응답 수신
 * 
 * POST /api/v1/response
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * 클라이언트 응답 수신
 */
router.post('/', (req, res) => {
    const { logger, taskQueue, deviceTracker } = req.context;
    
    try {
        const response = req.body;
        const { msg_id, device_id, status, result, metrics } = response;

        logger.info('[API] 응답 수신', {
            msg_id,
            device_id,
            status
        });

        // 작업 상태 업데이트
        if (msg_id) {
            if (status === 'SUCCESS') {
                taskQueue.complete(msg_id, result);
            } else if (status === 'FAILED' || status === 'TIMEOUT') {
                taskQueue.fail(msg_id, result?.error_message);
            } else if (status === 'REFUSED') {
                // 거절된 작업은 다른 기기로 재할당 가능
                taskQueue.fail(msg_id, 'REFUSED');
            }
        }

        // 기기 상태 업데이트
        if (device_id) {
            deviceTracker.updateHeartbeat(device_id);
            
            // 메트릭 기록 (옵션)
            if (metrics) {
                logger.debug('[API] 메트릭', { device_id, metrics });
            }
        }

        res.json({ 
            received: true,
            msg_id 
        });

    } catch (e) {
        logger.error('[API] 응답 처리 오류', { error: e.message });
        res.status(500).json({ 
            error: 'Response processing failed',
            message: e.message 
        });
    }
});

/**
 * Heartbeat 응답 (별도 엔드포인트)
 */
router.post('/heartbeat', (req, res) => {
    const { logger, deviceTracker } = req.context;
    const heartbeat = req.context.heartbeat;
    
    try {
        const { device_id, metrics } = req.body;

        if (!device_id) {
            return res.status(400).json({ error: 'device_id required' });
        }

        // Heartbeat 모니터에 응답 전달
        if (heartbeat) {
            heartbeat.handleResponse(device_id, metrics);
        }

        // 기기 상태 업데이트
        deviceTracker.updateHeartbeat(device_id);

        res.json({ 
            received: true,
            timestamp: Date.now() 
        });

    } catch (e) {
        logger.error('[API] Heartbeat 처리 오류', { error: e.message });
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

