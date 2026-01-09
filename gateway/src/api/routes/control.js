/**
 * Device Control API
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoints:
 * - POST /api/control/:id/touch        - Send touch event
 * - POST /api/control/:id/key          - Send key event  
 * - GET  /api/control/:id/screenshot   - Capture screen
 * - POST /api/control/:id/restart-autox - Restart AutoX.js
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// AutoX.js 패키지 정보
const AUTOX_PACKAGE = 'org.autojs.autoxjs.v6';
const AUTOX_ACTIVITY = 'org.autojs.autoxjs.v6.ui.main.MainActivity_';

/**
 * POST /api/control/:id/touch
 * 터치 이벤트 전송
 * 
 * Body:
 * - tap: { action: 'tap', x: 0.5, y: 0.3 }
 * - swipe: { action: 'swipe', start: {x, y}, end: {x, y}, duration_ms: 300 }
 * - long_press: { action: 'long_press', x: 0.5, y: 0.3, duration_ms: 1000 }
 */
router.post('/:id/touch', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { action, x, y, start, end, duration_ms } = req.body;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 화면 해상도 (기본값, 실제로는 기기에서 가져와야 함)
        const screenWidth = 1080;
        const screenHeight = 2340;

        let adbCommand;
        let actualCoords;

        switch (action) {
            case 'tap': {
                const pixelX = Math.round(x * screenWidth);
                const pixelY = Math.round(y * screenHeight);
                adbCommand = `input tap ${pixelX} ${pixelY}`;
                actualCoords = { x: pixelX, y: pixelY };
                break;
            }

            case 'swipe': {
                if (!start || !end || typeof start.x !== 'number' || typeof start.y !== 'number' ||
                    typeof end.x !== 'number' || typeof end.y !== 'number') {
                    return res.status(400).json({
                        success: false,
                        error: 'swipe requires start and end coordinates'
                    });
                }
                const startX = Math.round(start.x * screenWidth);
                const startY = Math.round(start.y * screenHeight);
                const endX = Math.round(end.x * screenWidth);
                const endY = Math.round(end.y * screenHeight);
                const duration = duration_ms || 300;
                adbCommand = `input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`;
                actualCoords = { 
                    start: { x: startX, y: startY },
                    end: { x: endX, y: endY }
                };
                break;            }

            case 'long_press': {
                const pixelX = Math.round(x * screenWidth);
                const pixelY = Math.round(y * screenHeight);
                const duration = duration_ms || 1000;
                // long_press = 같은 좌표로 스와이프
                adbCommand = `input swipe ${pixelX} ${pixelY} ${pixelX} ${pixelY} ${duration}`;
                actualCoords = { x: pixelX, y: pixelY };
                break;
            }

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action',
                    valid_actions: ['tap', 'swipe', 'long_press']
                });
        }

        // ADB 명령 실행
        await commander.shell(device.id, adbCommand);
        
        logger.info('[ControlAPI] 터치 이벤트 전송', {
            deviceId: id,
            action,
            actualCoords
        });

        res.json({
            success: true,
            executed_at: new Date().toISOString(),
            actual_coords: actualCoords
        });

    } catch (e) {
        logger.error('[ControlAPI] 터치 이벤트 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Touch event failed',
            message: e.message
        });
    }
});

/**
 * POST /api/control/:id/key
 * 키 입력 전송
 * 
 * Body:
 * - keycode: { keycode: 'KEYCODE_BACK' }
 * - text: { text: 'Hello World' }
 */
router.post('/:id/key', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { keycode, text } = req.body;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        let adbCommand;

        if (keycode) {
            // 키코드 입력
            adbCommand = `input keyevent ${keycode}`;
        } else if (text) {
            // 텍스트 입력 (특수문자 이스케이프)
            const escapedText = text
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/ /g, '%s')
                .replace(/\(/g, '\\(')
                .replace(/\)/g, '\\)')
                .replace(/&/g, '\\&')
                .replace(/</g, '\\<')
                .replace(/>/g, '\\>')
                .replace(/;/g, '\\;')
                .replace(/\|/g, '\\|');
            
            adbCommand = `input text "${escapedText}"`;
        } else {
            return res.status(400).json({
                success: false,
                error: 'keycode or text required'
            });
        }

        await commander.shell(device.id, adbCommand);
        
        logger.info('[ControlAPI] 키 입력 전송', {
            deviceId: id,
            keycode: keycode || 'text'
        });

        res.json({
            success: true,
            executed_at: new Date().toISOString()
        });

    } catch (e) {
        logger.error('[ControlAPI] 키 입력 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Key input failed',
            message: e.message
        });
    }
});

/**
 * GET /api/control/:id/screenshot
 * 스크린샷 캡처
 * 
 * Response: PNG image binary
 */
router.get('/:id/screenshot', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 스크린샷 캡처
        const screenshot = await commander.execOut(device.id, 'screencap -p');
        
        if (!screenshot || screenshot.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Screenshot capture failed'
            });
        }

        logger.info('[ControlAPI] 스크린샷 캡처', {
            deviceId: id,
            size: screenshot.length
        });

        res.set('Content-Type', 'image/png');
        res.set('Content-Length', screenshot.length);
        res.set('Cache-Control', 'no-store');
        res.send(screenshot);

    } catch (e) {
        logger.error('[ControlAPI] 스크린샷 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Screenshot failed',
            message: e.message
        });
    }
});

/**
 * POST /api/control/:id/restart-autox
 * AutoX.js 재시작
 */
router.post('/:id/restart-autox', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 1. AutoX.js 강제 종료
        await commander.shell(device.id, `am force-stop ${AUTOX_PACKAGE}`);
        logger.debug('[ControlAPI] AutoX.js 종료', { deviceId: id });

        // 2. 잠시 대기
        await sleep(1000);

        // 3. AutoX.js 시작
        await commander.shell(
            device.id, 
            `am start -n ${AUTOX_PACKAGE}/${AUTOX_ACTIVITY}`
        );
        logger.debug('[ControlAPI] AutoX.js 시작', { deviceId: id });

        // 4. main.js 실행 (broadcast로)
        await sleep(2000);
        await commander.shell(
            device.id,
            `am broadcast -a org.autojs.autoxjs.action.RUN_SCRIPT ` +
            `-e path /sdcard/doai/main.js ` +
            `--es com.stardust.autojs.extra.SCRIPT_PATH /sdcard/doai/main.js`
        );

        // 5. PID 확인
        const pidOutput = await commander.shell(
            device.id, 
            `pidof ${AUTOX_PACKAGE}`
        );
        const newPid = pidOutput ? parseInt(pidOutput.trim()) : null;

        logger.info('[ControlAPI] AutoX.js 재시작 완료', {
            deviceId: id,
            newPid
        });

        res.json({
            success: true,
            message: 'AutoX.js restarted',
            new_pid: newPid
        });

    } catch (e) {
        logger.error('[ControlAPI] AutoX.js 재시작 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Restart failed',
            message: e.message
        });
    }
});

/**
 * 유틸리티: sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;

