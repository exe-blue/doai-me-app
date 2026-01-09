/**
 * Command Executor
 * Vultr COMMAND를 받아 ADB/Laixi로 실행
 * 
 * WSS Protocol v1.0 → 로컬 실행 변환 레이어
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const EventEmitter = require('events');

class CommandExecutor extends EventEmitter {
    /**
     * @param {Object} options
     * @param {Object} options.adbClient - AdbClient 인스턴스
     * @param {Object} options.laixiAdapter - LaixiAdapter 인스턴스 (선택)
     * @param {Object} options.logger - 로거
     */
    constructor(options = {}) {
        super();
        
        this.adbClient = options.adbClient;
        this.laixiAdapter = options.laixiAdapter;
        this.logger = options.logger || console;
        
        // 명령 타입 → 핸들러 매핑
        this._handlers = new Map();
        this._registerDefaultHandlers();
    }
    
    /**
     * 명령 실행
     * @param {Object} command - Vultr COMMAND payload
     * @returns {Promise<Object>} 결과
     */
    async execute(command) {
        const { command_type, target, params, timeout_seconds } = command;
        
        this.logger.info(`[Executor] 명령 실행: ${command_type}`);
        
        // 핸들러 찾기
        const handler = this._handlers.get(command_type);
        if (!handler) {
            this.logger.warn(`[Executor] 알 수 없는 명령: ${command_type}`);
            return {
                status: 'FAILED',
                device_results: [],
                error: `Unknown command: ${command_type}`
            };
        }
        
        // 타겟 디바이스 결정
        const devices = await this._resolveTargetDevices(target);
        if (devices.length === 0) {
            return {
                status: 'FAILED',
                device_results: [],
                error: 'No target devices found'
            };
        }
        
        // 타임아웃 설정
        const timeout = (timeout_seconds || 300) * 1000;
        
        // 명령 실행
        const results = await this._executeWithTimeout(
            () => handler(devices, params),
            timeout
        );
        
        return results;
    }
    
    /**
     * 커스텀 핸들러 등록
     */
    registerHandler(commandType, handler) {
        this._handlers.set(commandType, handler);
    }
    
    // ============================================================
    // Default Handlers
    // ============================================================
    
    _registerDefaultHandlers() {
        // WATCH_VIDEO
        this._handlers.set('WATCH_VIDEO', async (devices, params) => {
            return this._executeOnDevices(devices, async (device) => {
                const { video_url, video_id, min_watch_seconds, max_watch_seconds, like } = params;
                
                // YouTube 딥링크로 열기
                const url = video_url || (video_id ? `vnd.youtube:${video_id}` : null);
                
                if (this.laixiAdapter?.isConnected) {
                    // Laixi 사용 - AutoX.js 스크립트 실행
                    try {
                        // 파라미터를 JSON으로 직렬화 후 Base64 인코딩 (쉘 인젝션 방지)
                        const argsPayload = { 
                            videoUrl: url, 
                            minWatchSeconds: min_watch_seconds || 30,
                            maxWatchSeconds: max_watch_seconds || 180,
                            like: like || false
                        };
                        const argsBase64 = Buffer.from(JSON.stringify(argsPayload)).toString('base64');
                        
                        // 스크립트 실행 (doai/youtube_watch.js) - Base64 인코딩된 args 전달
                        // 수신 스크립트에서 Base64 디코딩 후 JSON 파싱 필요
                        await this.laixiAdapter.executeAdb(
                            device.serial,
                            `am broadcast -a com.stardust.autojs.action.RUN_SCRIPT ` +
                            `-e script "doai/youtube_watch.js" ` +
                            `-e args_base64 "${argsBase64}"`
                        );
                        
                        // 시청 시간 대기 (스크립트가 자체적으로 대기하므로 여유 시간 추가)
                        const watchTime = this._randomBetween(
                            min_watch_seconds || 30,
                            max_watch_seconds || 180
                        );
                        await this._sleep((watchTime + 10) * 1000);
                        
                    } catch (err) {
                        // Laixi 스크립트 실행 실패 시 기본 방식으로 폴백
                        this.logger.warn(`[Executor] Laixi 스크립트 실패, ADB로 폴백: ${err.message}`);
                        if (url) {
                            await this.laixiAdapter.openUrl(device.serial, url);
                        }
                    }
                } else {
                    // 직접 ADB
                    if (url) {
                        await this.adbClient.shell(
                            device.serial,
                            `am start -a android.intent.action.VIEW -d "${url}"`
                        );
                    } else {
                        // URL 없으면 YouTube 앱 열기
                        await this.adbClient.shell(
                            device.serial,
                            'monkey -p com.google.android.youtube -c android.intent.category.LAUNCHER 1'
                        );
                    }
                    
                    // 시청 시간 대기
                    const watchTime = this._randomBetween(
                        min_watch_seconds || 30,
                        max_watch_seconds || 180
                    );
                    await this._sleep(watchTime * 1000);
                }
                
                return { status: 'SUCCESS', actions: ['open_video', 'watch'] };
            });
        });
        
        // RANDOM_WATCH
        this._handlers.set('RANDOM_WATCH', async (devices, params) => {
            return this._executeOnDevices(devices, async (device) => {
                // YouTube 앱 열기
                if (this.laixiAdapter?.isConnected) {
                    await this.laixiAdapter.openApp(device.serial, 'youtube');
                } else {
                    await this.adbClient.shell(
                        device.serial,
                        'monkey -p com.google.android.youtube -c android.intent.category.LAUNCHER 1'
                    );
                }
                
                await this._sleep(3000);
                
                // 랜덤 스크롤 + 탭
                const scrollCount = this._randomBetween(1, 5);
                for (let i = 0; i < scrollCount; i++) {
                    if (this.laixiAdapter?.isConnected) {
                        await this.laixiAdapter.swipe(device.serial, 'up');
                    } else {
                        await this.adbClient.shell(
                            device.serial,
                            'input swipe 500 1500 500 500 300'
                        );
                    }
                    await this._sleep(1000);
                }
                
                // 영상 탭
                if (this.laixiAdapter?.isConnected) {
                    await this.laixiAdapter.tap(device.serial, 0.5, 0.4);
                } else {
                    await this.adbClient.shell(device.serial, 'input tap 540 800');
                }
                
                // 시청
                const watchTime = this._randomBetween(30, 120);
                await this._sleep(watchTime * 1000);
                
                return { status: 'SUCCESS', actions: ['open_app', 'scroll', 'tap', 'watch'] };
            });
        });
        
        // LIKE_VIDEO
        this._handlers.set('LIKE_VIDEO', async (devices, params) => {
            return this._executeOnDevices(devices, async (device) => {
                // 좋아요 버튼 위치 (YouTube 기준, 대략적)
                if (this.laixiAdapter?.isConnected) {
                    await this.laixiAdapter.tap(device.serial, 0.15, 0.85);
                } else {
                    await this.adbClient.shell(device.serial, 'input tap 160 1600');
                }
                
                return { status: 'SUCCESS', actions: ['like'] };
            });
        });
        
        // RESTART_DEVICE
        this._handlers.set('RESTART_DEVICE', async (devices, params) => {
            return this._executeOnDevices(devices, async (device) => {
                // 디바이스 재부팅
                await this.adbClient.shell(device.serial, 'reboot');
                return { status: 'SUCCESS', actions: ['reboot'] };
            });
        });
        
        // SYNC_STATE
        this._handlers.set('SYNC_STATE', async (devices, params) => {
            // 상태 동기화 (특별한 동작 없음)
            return {
                status: 'SUCCESS',
                device_results: devices.map(d => ({
                    slot: d.slot,
                    serial: d.serial,
                    status: 'SUCCESS',
                    duration_seconds: 0,
                    actions_performed: []
                }))
            };
        });
    }
    
    // ============================================================
    // Execution Helpers
    // ============================================================
    
    async _resolveTargetDevices(target) {
        const allDevices = await this.adbClient.listDevices();
        
        if (!target || target.type === 'ALL_DEVICES') {
            return allDevices.map((d, i) => ({
                slot: i + 1,
                serial: d.id
            }));
        }
        
        if (target.type === 'SPECIFIC_DEVICES' && target.device_slots) {
            return allDevices
                .filter((d, i) => target.device_slots.includes(i + 1))
                .map((d, i) => ({
                    slot: target.device_slots[i],
                    serial: d.id
                }));
        }
        
        return allDevices.map((d, i) => ({
            slot: i + 1,
            serial: d.id
        }));
    }
    
    async _executeOnDevices(devices, handler) {
        const results = [];
        
        // 병렬 실행
        const promises = devices.map(async (device) => {
            const startTime = Date.now();
            
            try {
                const result = await handler(device);
                
                results.push({
                    slot: device.slot,
                    serial: device.serial,
                    status: result.status || 'SUCCESS',
                    duration_seconds: (Date.now() - startTime) / 1000,
                    actions_performed: result.actions?.map(a => ({
                        action: a,
                        timestamp: new Date().toISOString(),
                        success: true
                    })) || [],
                    error: null
                });
                
            } catch (err) {
                results.push({
                    slot: device.slot,
                    serial: device.serial,
                    status: 'FAILED',
                    duration_seconds: (Date.now() - startTime) / 1000,
                    actions_performed: [],
                    error: err.message
                });
            }
        });
        
        await Promise.all(promises);
        
        // 결과 집계
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        const totalCount = results.length;
        
        let status;
        if (successCount === totalCount) {
            status = 'SUCCESS';
        } else if (successCount > 0) {
            status = 'PARTIAL_SUCCESS';
        } else {
            status = 'FAILED';
        }
        
        return {
            status,
            device_results: results
        };
    }
    
    async _executeWithTimeout(fn, timeout) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Execution timeout')), timeout)
            )
        ]);
    }
    
    // ============================================================
    // Utilities
    // ============================================================
    
    _randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CommandExecutor;

