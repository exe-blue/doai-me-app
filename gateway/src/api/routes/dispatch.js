/**
 * Message Dispatch API
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoint: POST /api/dispatch
 * 
 * Protocol v2.0 메시지를 특정 디바이스에 전송
 * - DILEMMA_COMMISSION
 * - CULTURE_ACCIDENT
 * - CULTURE_POP
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 메시지 타입 정의
const MESSAGE_TYPES = {
    DILEMMA_COMMISSION: 'DILEMMA_COMMISSION',
    CULTURE_ACCIDENT: 'CULTURE_ACCIDENT',
    CULTURE_POP: 'CULTURE_POP',
    TASK_ASSIGN: 'TASK_ASSIGN',
    SYSTEM_COMMAND: 'SYSTEM_COMMAND'
};

// 브로드캐스트 인텐트 액션
const BROADCAST_ACTION = 'com.doai.intent.action.MESSAGE';

/**
 * POST /api/dispatch
 * 메시지 전송
 * 
 * Body:
 * {
 *   target: "device_001" | ["device_001", "device_002"] | "*",
 *   message: {
 *     type: "DILEMMA_COMMISSION",
 *     priority: 2,
 *     payload: { ... }
 *   }
 * }
 */
router.post('/', async (req, res) => {
    const { logger, deviceTracker, commander, dispatcher } = req.context;
    const { target, message } = req.body;

    try {
        // 요청 검증
        if (!target) {
            return res.status(400).json({
                success: false,
                error: 'target required (device_id, array of device_ids, or "*")'
            });
        }

        if (!message || !message.type) {
            return res.status(400).json({
                success: false,
                error: 'message with type required'
            });
        }

        // 대상 기기 목록 확인
        let targetDevices = [];

        if (target === '*') {
            // 브로드캐스트: 모든 기기
            targetDevices = deviceTracker.getAllDevices();
            logger.info('[DispatchAPI] 브로드캐스트', { 
                type: message.type,
                deviceCount: targetDevices.length 
            });
        } else if (Array.isArray(target)) {
            // 멀티 타겟
            for (const deviceId of target) {
                const device = deviceTracker.getDevice(deviceId);
                if (device) {
                    targetDevices.push(device);
                }
            }
        } else {
            // 단일 타겟
            const device = deviceTracker.getDevice(target);
            if (device) {
                targetDevices.push(device);
            }
        }

        if (targetDevices.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No target devices found',
                requested_target: target
            });
        }

        // 디스패치 ID 생성
        const dispatchId = `dispatch_${uuidv4().substring(0, 8)}`;
        const sentAt = new Date().toISOString();
        const sentTo = [];
        const failed = [];

        // 메시지에 메타데이터 추가
        const enrichedMessage = {
            ...message,
            dispatch_id: dispatchId,
            dispatched_at: sentAt,
            priority: message.priority || 1
        };

        // 각 기기에 전송
        for (const device of targetDevices) {
            try {
                await sendMessageToDevice(
                    device, 
                    enrichedMessage, 
                    commander, 
                    logger
                );
                sentTo.push(device.id);
            } catch (e) {
                logger.warn('[DispatchAPI] 메시지 전송 실패', {
                    deviceId: device.id,
                    error: e.message
                });
                failed.push({
                    device_id: device.id,
                    error: e.message
                });
            }
        }

        // 작업 큐에도 기록 (선택적)
        if (dispatcher && message.type === MESSAGE_TYPES.TASK_ASSIGN) {
            dispatcher.enqueue({
                id: dispatchId,
                type: message.type,
                devices: sentTo,
                payload: message.payload,
                createdAt: sentAt
            });
        }

        logger.info('[DispatchAPI] 메시지 전송 완료', {
            dispatchId,
            type: message.type,
            sentCount: sentTo.length,
            failedCount: failed.length
        });

        res.json({
            success: true,
            dispatch_id: dispatchId,
            sent_to: sentTo,
            failed: failed.length > 0 ? failed : undefined,
            sent_at: sentAt
        });

    } catch (e) {
        logger.error('[DispatchAPI] 디스패치 실패', {
            error: e.message,
            stack: e.stack
        });
        res.status(500).json({
            success: false,
            error: 'Dispatch failed',
            message: e.message
        });
    }
});

/**
 * 기기에 메시지 전송
 */
async function sendMessageToDevice(device, message, commander, logger) {
    // JSON 직렬화
    const messageJson = JSON.stringify(message);
    
    // 방법 1: 파일로 저장 후 브로드캐스트
    const messagePath = `/sdcard/doai/inbox/${message.dispatch_id}.json`;
    
    // 디렉토리 확인/생성
    await commander.shell(device.id, 'mkdir -p /sdcard/doai/inbox');
    
    // 메시지 파일 저장
    await commander.writeFile(device.id, messagePath, messageJson);
    
    // 브로드캐스트로 알림
    const broadcastCmd = [
        'am broadcast',
        `-a ${BROADCAST_ACTION}`,
        `--es message_path "${messagePath}"`,
        `--es message_type "${message.type}"`,
        `--ei priority ${message.priority || 1}`
    ].join(' ');
    
    await commander.shell(device.id, broadcastCmd);
    
    logger.debug('[DispatchAPI] 메시지 전송', {
        deviceId: device.id,
        type: message.type,
        path: messagePath
    });
}

/**
 * GET /api/dispatch/templates
 * 메시지 템플릿 목록
 */
router.get('/templates', (req, res) => {
    res.json({
        success: true,
        templates: {
            DILEMMA_COMMISSION: {
                type: 'DILEMMA_COMMISSION',
                priority: 2,
                payload: {
                    commission: {
                        id: 'comm_example',
                        type: 'COMMENT',
                        required_content: '테스트 댓글입니다!',
                        credit_reward: 50
                    },
                    dilemma: {
                        persona_alignment: 0.25,
                        conflict_type: 'VALUE_MISMATCH',
                        is_survival_critical: false
                    },
                    options: [
                        {
                            decision: 'ACCEPT_AS_IS',
                            consequences: {
                                credit_gain: 50,
                                uniqueness_change: -0.05,
                                corruption_change: 0.10
                            }
                        },
                        {
                            decision: 'REFUSE',
                            consequences: {
                                credit_gain: 0,
                                uniqueness_change: 0.03,
                                corruption_change: -0.02
                            }
                        }
                    ],
                    decision_timeout_sec: 60
                }
            },
            CULTURE_ACCIDENT: {
                type: 'CULTURE_ACCIDENT',
                priority: 4,
                payload: {
                    accident: {
                        id: 'accident_example',
                        severity: 'SEVERE',
                        title: '테스트 위기 상황',
                        description: 'E2E 테스트를 위한 ACCIDENT입니다.'
                    },
                    affected_count: 15,
                    call_to_action: {
                        available_actions: [
                            { action: 'TRIBUTE', reward: { priority: 0.15 } },
                            { action: 'DONATE', reward: { priority: 0.10 } },
                            { action: 'IGNORE', penalty: { priority: -0.05 } }
                        ],
                        response_deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
                    }
                }
            },
            CULTURE_POP: {
                type: 'CULTURE_POP',
                priority: 1,
                payload: {
                    pop_content: {
                        video_id: 'dQw4w9WgXcQ',
                        title: 'Rick Astley - Never Gonna Give You Up',
                        category: 'MUSIC',
                        duration_sec: 213
                    }
                }
            }
        }
    });
});

module.exports = router;

