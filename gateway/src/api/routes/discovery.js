/**
 * Discovery API Router
 * 
 * Aria 명세서 (2025-01-15) - Dynamic Device Architecture v3.0
 * 
 * Endpoints:
 * - POST /api/discovery/scan        - Manual scan trigger
 * - POST /api/discovery/devices     - Add known device
 * - DELETE /api/discovery/devices/:serial - Remove device
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/discovery/scan
 * 수동 스캔 트리거
 * 
 * Request Body (optional):
 * {
 *   types: ["USB", "WIFI"],  // 특정 타입만 스캔
 *   targets: ["192.168.1.0/24"]  // 추가 스캔 대상
 * }
 */
router.post('/scan', async (req, res) => {
    const { logger, discoveryManager } = req.context;
    const { types, targets } = req.body || {};

    try {
        logger.info('[DiscoveryAPI] 수동 스캔 요청', { types, targets });

        const scanResult = await discoveryManager.rescan();

        res.json({
            success: true,
            scanResult: {
                duration: scanResult.duration,
                totalFound: scanResult.totalFound,
                byType: scanResult.byType
            }
        });

    } catch (e) {
        logger.error('[DiscoveryAPI] 스캔 실패', { error: e.message });
        res.status(500).json({
            success: false,
            error: 'Scan failed',
            message: e.message
        });
    }
});

/**
 * POST /api/discovery/devices
 * 디바이스 수동 추가
 * 
 * Request Body:
 * {
 *   address: "192.168.1.200:5555",
 *   type: "WIFI"  // or "LAN"
 * }
 */
router.post('/devices', async (req, res) => {
    const { logger, discoveryManager } = req.context;
    const { address, type } = req.body;

    if (!address) {
        return res.status(400).json({
            success: false,
            error: 'address required'
        });
    }

    try {
        logger.info('[DiscoveryAPI] 디바이스 추가 요청', { address, type });

        const device = await discoveryManager.addDevice(address, type || 'WIFI');

        if (!device) {
            return res.status(400).json({
                success: false,
                error: 'Failed to connect device',
                address
            });
        }

        res.json({
            success: true,
            device
        });

    } catch (e) {
        logger.error('[DiscoveryAPI] 디바이스 추가 실패', { 
            address, 
            error: e.message 
        });
        res.status(500).json({
            success: false,
            error: 'Failed to add device',
            message: e.message
        });
    }
});

/**
 * DELETE /api/discovery/devices/:serial
 * 디바이스 제거
 */
router.delete('/devices/:serial', async (req, res) => {
    const { logger, discoveryManager } = req.context;
    const { serial } = req.params;

    try {
        const removed = discoveryManager.removeDevice(serial);

        if (!removed) {
            return res.status(404).json({
                success: false,
                error: 'Device not found',
                serial
            });
        }

        logger.info('[DiscoveryAPI] 디바이스 제거', { serial });

        res.json({
            success: true,
            message: 'Device removed from registry'
        });

    } catch (e) {
        logger.error('[DiscoveryAPI] 디바이스 제거 실패', { 
            serial, 
            error: e.message 
        });
        res.status(500).json({
            success: false,
            error: 'Failed to remove device',
            message: e.message
        });
    }
});

/**
 * GET /api/discovery/status
 * Discovery 상태 조회
 */
router.get('/status', async (req, res) => {
    const { discoveryManager } = req.context;

    const count = discoveryManager.getDeviceCount();

    res.json({
        success: true,
        status: {
            ...count,
            lastScanTime: discoveryManager.lastScanTime,
            isScanning: discoveryManager.isScanning
        }
    });
});

module.exports = router;

