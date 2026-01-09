/**
 * Device Management API
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoints:
 * - GET /api/devices          - List all devices
 * - GET /api/devices/:id      - Get single device
 * - GET /api/devices/:id/state - Get device state.json
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/devices
 * 모든 기기 목록 조회 (Dynamic Discovery 기반)
 * 
 * Response:
 * {
 *   success: true,
 *   timestamp: "2025-01-15T12:00:00Z",
 *   count: { total, online, offline, byType },
 *   devices: [{ serial, connectionType, status, model, ... }]
 * }
 */
router.get('/', async (req, res) => {
    const { logger, discoveryManager, commander } = req.context;

    try {
        // DiscoveryManager에서 디바이스 목록 조회
        const devices = discoveryManager.getDevices();
        const deviceList = [];

        for (const device of devices) {
            const deviceInfo = await enrichDeviceInfo(device, commander, logger);
            deviceList.push(deviceInfo);
        }

        // 메트릭 기준 정렬 (existence_score 높은 순)
        deviceList.sort((a, b) => {
            const aScore = a.metrics?.existence_score || 0;
            const bScore = b.metrics?.existence_score || 0;
            return bScore - aScore;
        });

        const count = discoveryManager.getDeviceCount();

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            count,
            devices: deviceList
        });

    } catch (e) {
        logger.error('[DeviceAPI] 기기 목록 조회 실패', { error: e.message });
        res.status(500).json({
            success: false,
            error: 'Failed to list devices',
            message: e.message
        });
    }
});

/**
 * GET /api/devices/:id
 * 단일 기기 상세 조회
 */
router.get('/:id', async (req, res) => {
    const { logger, discoveryManager, commander, taskQueue } = req.context;
    const { id } = req.params;

    try {
        // DiscoveryManager에서 디바이스 조회
        const device = discoveryManager.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found',
                device_id: id
            });
        }

        const deviceInfo = await enrichDeviceInfo(device, commander, logger);
        
        // 현재 작업 정보
        const currentTask = taskQueue?.getCurrentTask?.(id);
        
        // 대기 중인 이벤트
        const pendingEvents = taskQueue?.getPendingEvents?.(id) || [];

        res.json({
            success: true,
            device: {
                ...deviceInfo,
                current_task: currentTask ? {
                    type: currentTask.type,
                    video_id: currentTask.payload?.video_id,
                    progress: currentTask.progress || 0,
                    started_at: currentTask.startedAt
                } : null,
                pending_events: pendingEvents.map(e => ({
                    type: e.type,
                    received_at: e.receivedAt
                })),
                stream_url: `/stream/${id}/view`
            }
        });

    } catch (e) {
        logger.error('[DeviceAPI] 기기 조회 실패', { 
            deviceId: id, 
            error: e.message 
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get device',
            message: e.message
        });
    }
});

/**
 * GET /api/devices/:id/state
 * 기기 state.json 직접 조회
 */
router.get('/:id/state', async (req, res) => {
    const { logger, discoveryManager, commander } = req.context;
    const { id } = req.params;

    try {
        const device = discoveryManager.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // state.json 읽기
        const statePath = '/sdcard/doai/state.json';
        const stateContent = await commander.readFile(device.serial, statePath);
        
        if (!stateContent) {
            return res.status(404).json({
                success: false,
                error: 'State file not found',
                path: statePath
            });
        }

        const state = JSON.parse(stateContent);
        
        res.json({
            success: true,
            ...state,
            last_updated: new Date().toISOString()
        });

    } catch (e) {
        logger.error('[DeviceAPI] state.json 조회 실패', { 
            deviceId: id, 
            error: e.message 
        });
        res.status(500).json({
            success: false,
            error: 'Failed to read state',
            message: e.message
        });
    }
});

/**
 * 디바이스 정보 보강 (state.json에서 AI 시민 정보 로드)
 */
async function enrichDeviceInfo(device, commander, logger) {
    let aiCitizen = null;
    let metrics = {
        existence_score: 0.5,
        priority: 0.5,
        uniqueness: 0.5,
        corruption: 0
    };

    try {
        // state.json에서 시민 정보 읽기
        const statePath = '/sdcard/doai/state.json';
        const stateContent = await commander.readFile(device.serial, statePath);
        
        if (stateContent) {
            const state = JSON.parse(stateContent);
            
            if (state.citizen) {
                aiCitizen = {
                    id: state.citizen.id,
                    name: state.citizen.name,
                    existence_state: state.citizen.existence_state || 'ACTIVE'
                };
            }
            
            if (state.metrics) {
                metrics = {
                    existence_score: state.metrics.existence_score || 0.5,
                    priority: state.metrics.priority || 0.5,
                    uniqueness: state.metrics.uniqueness || 0.5,
                    corruption: state.metrics.corruption || 0
                };
            }
        }
    } catch (e) {
        // state.json 없으면 기본값 사용
        logger.debug('[DeviceAPI] state.json 읽기 실패', { 
            serial: device.serial, 
            error: e.message 
        });
    }

    // Discovery 정보와 병합
    return {
        serial: device.serial,
        connectionType: device.connectionType,
        status: device.status,
        model: device.model,
        androidVersion: device.androidVersion,
        displaySize: device.displaySize,
        connectedAt: device.connectedAt,
        lastSeenAt: device.lastSeenAt,
        
        // AI 시민 정보
        aiCitizenId: device.aiCitizenId || aiCitizen?.id,
        aiCitizen,
        metrics,
        
        // 연결 상태
        gatewayClientConnected: device.gatewayClientConnected,
        streamAvailable: device.status === 'ONLINE'
    };
}

module.exports = router;

