/**
 * SYSTEM Handler
 * 기기/클라이언트 관리 및 유지보수
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - HEARTBEAT: 연결 상태 모니터링
 * - COLLECT_LOGS: 비동기 로그 업로드
 * - SCREENSHOT: 디버깅용 스크린샷
 * - WAKE, RESTART_APP, UPDATE_CONFIG, CLEAR_CACHE
 * 
 * @author Axon (Tech Lead)
 * @version 1.1.0
 */

// 'nodejs' 지시자 제거됨 - AutoX.js는 자체 런타임 사용

// ===========================================
// 상수 정의 (매직 넘버 제거)
// ===========================================
const KEYCODE_WAKEUP = 224;
const KEYCODE_POWER = 26;
const DEFAULT_SWIPE_START_Y = 1500;
const DEFAULT_SWIPE_END_Y = 500;
const DEFAULT_SWIPE_X = 540;
const DEFAULT_SWIPE_DURATION = 500;
const WAKE_DELAY_MS = 1000;
const SCREEN_CAPTURE_TIMEOUT_MS = 10000;
const SCREEN_CAPTURE_SETTLE_MS = 500;
const MAX_LOG_CONTENT_SIZE = 10000;  // 10KB
const DEFAULT_CACHE_PATH = '/sdcard/doai/cache';

/**
 * 시스템 명령 타입
 */
const SystemCommand = {
    WAKE: 'WAKE',
    RESTART_APP: 'RESTART_APP',
    COLLECT_LOGS: 'COLLECT_LOGS',
    HEARTBEAT: 'HEARTBEAT',
    UPDATE_CONFIG: 'UPDATE_CONFIG',
    CLEAR_CACHE: 'CLEAR_CACHE',
    SCREENSHOT: 'SCREENSHOT'
};

/**
 * Wake 방법
 */
const WakeMethod = {
    KEYEVENT: 'KEYEVENT',
    SWIPE: 'SWIPE',
    POWER_BUTTON: 'POWER_BUTTON'
};

/**
 * 설정 변경 허용 키 목록 (화이트리스트)
 */
const ALLOWED_CONFIG_KEYS = [
    'log_level',
    'heartbeat_interval',
    'max_retry_count',
    'timeout_seconds',
    'youtube_watch_duration',
    'scroll_delay',
    'like_probability'
];

/**
 * 비동기 지연 함수 (non-blocking)
 */
function asyncDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class SystemHandler {
    constructor(logger, state, network) {
        this.logger = logger;
        this.state = state;
        this.network = network;
    }

    /**
     * SYSTEM 메시지 처리
     * @param {Object} message - Base Envelope with SYSTEM payload
     * @returns {Object} 처리 결과
     */
    handle(message) {
        const startTime = Date.now();
        
        // 입력 검증 (try 블록 밖에서 발생할 수 있는 에러 방지)
        if (!message || typeof message !== 'object') {
            this.logger.error('[SYSTEM] ❌ 유효하지 않은 메시지 형식');
            return {
                msg_id: null,
                status: 'FAILED',
                result: {
                    execution_time_ms: 0,
                    data: null,
                    error_code: 'E_INVALID_MESSAGE',
                    error_message: '유효하지 않은 메시지 형식'
                },
                metrics: null
            };
        }
        
        const { id, payload } = message;
        
        if (!payload || typeof payload !== 'object') {
            this.logger.error('[SYSTEM] ❌ payload가 없거나 유효하지 않음');
            return {
                msg_id: id,
                status: 'FAILED',
                result: {
                    execution_time_ms: 0,
                    data: null,
                    error_code: 'E_INVALID_PAYLOAD',
                    error_message: 'payload가 없거나 유효하지 않음'
                },
                metrics: null
            };
        }
        
        const { command } = payload;

        this.logger.info('[SYSTEM] ⚙️ 명령 처리', {
            id,
            command
        });

        const result = {
            msg_id: id,
            status: 'SUCCESS',
            result: {
                execution_time_ms: 0,
                data: null,
                error_code: null,
                error_message: null
            },
            metrics: null
        };

        try {
            switch (command) {
                case SystemCommand.HEARTBEAT:
                    result.result.data = this._handleHeartbeat(payload.heartbeat);
                    result.metrics = this._collectMetrics(payload.heartbeat?.include_metrics);
                    break;

                case SystemCommand.WAKE:
                    result.result.data = this._handleWake(payload.wake);
                    break;

                case SystemCommand.RESTART_APP:
                    result.result.data = this._handleRestartApp(payload.restart_app);
                    break;

                case SystemCommand.COLLECT_LOGS:
                    result.result.data = this._handleCollectLogs(payload.collect_logs);
                    break;

                case SystemCommand.UPDATE_CONFIG:
                    result.result.data = this._handleUpdateConfig(payload.update_config);
                    break;

                case SystemCommand.CLEAR_CACHE:
                    result.result.data = this._handleClearCache();
                    break;

                case SystemCommand.SCREENSHOT:
                    result.result.data = this._handleScreenshot(payload.screenshot);
                    break;

                default:
                    result.status = 'FAILED';
                    result.result.error_code = 'E_UNKNOWN_COMMAND';
                    result.result.error_message = `알 수 없는 시스템 명령: ${command}`;
            }

            this.logger.info('[SYSTEM] ✅ 명령 완료', { id, command });

        } catch (e) {
            result.status = 'FAILED';
            result.result.error_code = 'E_SYSTEM_HANDLER';
            result.result.error_message = e.message;

            this.logger.error('[SYSTEM] ❌ 명령 실패', {
                id,
                command,
                error: e.message
            });
        } finally {
            result.result.execution_time_ms = Date.now() - startTime;
        }

        return result;
    }

    /**
     * HEARTBEAT 처리
     */
    _handleHeartbeat(config) {
        this.state.updateHeartbeat();

        this.logger.debug('[SYSTEM] Heartbeat 응답', {
            timestamp: Date.now()
        });

        return {
            alive: true,
            timestamp: Date.now()
        };
    }

    /**
     * 메트릭 수집
     */
    _collectMetrics(includeMetrics) {
        if (!includeMetrics) return null;

        const metrics = this.state.collectMetricsForHeartbeat();

        this.logger.debug('[SYSTEM] 메트릭 수집', metrics);

        return metrics;
    }

    /**
     * WAKE 처리 - 화면 깨우기
     * 
     * 개선사항:
     * - 비동기 지연 대신 동기 sleep 유지 (AutoX.js 특성)
     * - device 객체 존재 확인 추가
     * - 화면 크기 기반 동적 좌표 계산
     */
    async _handleWake(config) {
        const method = config?.method || WakeMethod.KEYEVENT;
        const keepAwakeSec = config?.keep_awake_sec || 300;

        this.logger.debug('[SYSTEM] 화면 깨우기', { method, keepAwakeSec });

        try {
            // 화면 크기 기반 동적 좌표 계산
            let swipeX = DEFAULT_SWIPE_X;
            let swipeStartY = DEFAULT_SWIPE_START_Y;
            let swipeEndY = DEFAULT_SWIPE_END_Y;
            
            // device 객체가 존재하면 화면 크기 기반 계산
            if (typeof device !== 'undefined' && device.width && device.height) {
                swipeX = Math.floor(device.width / 2);
                swipeStartY = Math.floor(device.height * 0.7);
                swipeEndY = Math.floor(device.height * 0.25);
            }

            switch (method) {
                case WakeMethod.KEYEVENT:
                    if (typeof KeyCode === 'function') {
                        KeyCode(KEYCODE_WAKEUP);
                    } else {
                        throw new Error('KeyCode 함수를 사용할 수 없습니다');
                    }
                    break;

                case WakeMethod.SWIPE:
                    if (typeof swipe === 'function') {
                        swipe(swipeX, swipeStartY, swipeX, swipeEndY, DEFAULT_SWIPE_DURATION);
                    } else {
                        throw new Error('swipe 함수를 사용할 수 없습니다');
                    }
                    break;

                case WakeMethod.POWER_BUTTON:
                    if (typeof KeyCode === 'function') {
                        KeyCode(KEYCODE_POWER);
                    } else {
                        throw new Error('KeyCode 함수를 사용할 수 없습니다');
                    }
                    break;
            }

            // 비동기 지연 사용
            await asyncDelay(WAKE_DELAY_MS);

            // 화면 유지 설정
            if (keepAwakeSec > 0 && typeof device !== 'undefined' && device.keepScreenOn) {
                try {
                    device.keepScreenOn(keepAwakeSec * 1000);
                } catch (e) {
                    this.logger.warn('[SYSTEM] keepScreenOn 실패', { error: e.message });
                }
            }

            return {
                woke: true,
                method,
                keep_awake_sec: keepAwakeSec
            };

        } catch (e) {
            this.logger.warn('[SYSTEM] 화면 깨우기 실패', { error: e.message });
            return { woke: false, error: e.message };
        }
    }

    /**
     * RESTART_APP 처리 - 앱 재시작
     * 
     * 중요: 이 함수는 재시작 플래그만 설정합니다.
     * 실제 재시작은 외부 Watchdog 또는 Gateway가 처리합니다.
     * 
     * 왜 이렇게 작성했는가?
     * - 스크립트가 자기 자신을 강제 종료할 수 없음
     * - Gateway에서 재시작 플래그를 감지하고 ADB 명령으로 재시작 처리
     */
    _handleRestartApp(config) {
        const packageName = config?.package || 'org.autojs.autoxjs.v6';
        const scriptToRun = config?.script_to_run || 'main.js';
        const forceStop = config?.force_stop !== false;

        this.logger.warn('[SYSTEM] 앱 재시작 요청', {
            package: packageName,
            script: scriptToRun,
            forceStop
        });

        try {
            // 재시작 플래그 설정 (Gateway/Watchdog이 감지)
            // 주의: 이 함수는 직접 재시작하지 않음
            this.state.setFlag('needs_restart', true);
            this.state.setFlag('restart_package', packageName);
            this.state.setFlag('restart_script', scriptToRun);

            this.logger.info('[SYSTEM] 재시작 플래그 설정됨 - Gateway가 처리 예정');

            return {
                scheduled: true,
                package: packageName,
                script: scriptToRun,
                note: '재시작은 Gateway에서 처리됩니다'
            };

        } catch (e) {
            this.logger.error('[SYSTEM] 앱 재시작 실패', { error: e.message });
            return { scheduled: false, error: e.message };
        }
    }

    /**
     * COLLECT_LOGS 처리 - 로그 수집
     * 
     * 개선사항:
     * - 파일별 에러 처리 추가
     * - content가 문자열인지 검증
     * - 업로드 구현 추가
     */
    async _handleCollectLogs(config) {
        const logTypes = config?.log_types || ['ERROR'];
        const sinceTs = config?.since_ts || 0;
        const uploadEndpoint = config?.upload_endpoint;
        const compress = config?.compress !== false;

        this.logger.debug('[SYSTEM] 로그 수집', {
            logTypes,
            sinceTs,
            compress
        });

        const logs = [];
        const errors = [];

        try {
            // 로그 파일 경로
            const logDir = '/sdcard/doai/logs';

            // 로그 파일 읽기
            if (files.exists(logDir)) {
                const logFiles = files.listDir(logDir);
                
                for (const file of logFiles) {
                    const filePath = logDir + '/' + file;
                    
                    try {
                        const stat = files.getStat(filePath);
                        
                        // 시간 필터
                        if (stat.lastModified >= sinceTs) {
                            const rawContent = files.read(filePath);
                            
                            // content가 문자열인지 검증
                            const content = typeof rawContent === 'string' 
                                ? rawContent 
                                : String(rawContent || '');
                            
                            logs.push({
                                file,
                                size: content.length,
                                content: content.substring(0, MAX_LOG_CONTENT_SIZE)
                            });
                        }
                    } catch (fileError) {
                        // 개별 파일 에러는 기록하고 계속 진행
                        this.logger.warn('[SYSTEM] 파일 읽기 실패', { 
                            file, 
                            error: fileError.message 
                        });
                        errors.push({ file, error: fileError.message });
                    }
                }
            }

            // 업로드 구현
            if (uploadEndpoint && this.network) {
                try {
                    const uploadResult = await this.network.uploadLogs(uploadEndpoint, logs);
                    this.logger.info('[SYSTEM] 로그 업로드 완료', { 
                        count: logs.length,
                        success: uploadResult 
                    });
                } catch (uploadError) {
                    this.logger.error('[SYSTEM] 로그 업로드 실패', { 
                        error: uploadError.message 
                    });
                    errors.push({ type: 'upload', error: uploadError.message });
                }
            }

            return {
                collected: logs.length,
                logs: logs.map(l => ({ file: l.file, size: l.size })),
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (e) {
            this.logger.error('[SYSTEM] 로그 수집 실패', { error: e.message });
            return { collected: 0, error: e.message };
        }
    }

    /**
     * UPDATE_CONFIG 처리 - 설정 업데이트
     * 
     * 보안 개선:
     * - 허용된 키만 업데이트 (화이트리스트)
     * - 타입 검증 추가
     */
    _handleUpdateConfig(config) {
        const version = config?.config_version;
        const changes = config?.changes || {};

        this.logger.info('[SYSTEM] 설정 업데이트', {
            version,
            changes: Object.keys(changes)
        });

        try {
            // 변경 사항 검증 및 필터링
            const validatedChanges = {};
            const rejectedKeys = [];
            
            for (const [key, value] of Object.entries(changes)) {
                if (ALLOWED_CONFIG_KEYS.includes(key)) {
                    // 기본 타입 검증
                    if (value !== null && value !== undefined) {
                        validatedChanges[key] = value;
                    }
                } else {
                    rejectedKeys.push(key);
                    this.logger.warn('[SYSTEM] 허용되지 않은 설정 키 거부됨', { key });
                }
            }
            
            if (Object.keys(validatedChanges).length === 0) {
                return {
                    updated: false,
                    error: '유효한 변경 사항이 없습니다',
                    rejected_keys: rejectedKeys
                };
            }

            // 설정 파일 경로
            const configPath = '/sdcard/doai/config/runtime.json';
            
            let currentConfig = {};
            if (files.exists(configPath)) {
                currentConfig = JSON.parse(files.read(configPath));
            }

            // 검증된 변경 사항만 병합
            Object.assign(currentConfig, validatedChanges);
            currentConfig._version = version;
            currentConfig._updated_at = Date.now();

            // 디렉토리 확인
            const dir = configPath.substring(0, configPath.lastIndexOf('/'));
            if (!files.exists(dir)) {
                files.ensureDir(dir + '/');
            }

            // 저장
            files.write(configPath, JSON.stringify(currentConfig, null, 2));

            return {
                updated: true,
                version,
                applied: Object.keys(validatedChanges),
                rejected_keys: rejectedKeys.length > 0 ? rejectedKeys : undefined
            };

        } catch (e) {
            this.logger.error('[SYSTEM] 설정 업데이트 실패', { error: e.message });
            return { updated: false, error: e.message };
        }
    }

    /**
     * CLEAR_CACHE 처리 - 캐시 정리
     * 
     * 보안 개선:
     * - 경로 검증 추가
     * - 위험한 경로 삭제 방지
     */
    _handleClearCache(config) {
        this.logger.info('[SYSTEM] 캐시 정리');

        try {
            const cacheDir = DEFAULT_CACHE_PATH;
            
            // 경로 안전성 검증
            // 루트, 빈 문자열, 너무 짧은 경로 거부
            if (!cacheDir || 
                cacheDir.length < 15 || 
                cacheDir === '/' || 
                !cacheDir.startsWith('/sdcard/doai/')) {
                this.logger.error('[SYSTEM] 위험한 캐시 경로 거부됨', { cacheDir });
                return { 
                    cleared: false, 
                    error: '안전하지 않은 캐시 경로' 
                };
            }
            
            if (files.exists(cacheDir)) {
                // 삭제 전 파일 수 카운트
                const fileCount = files.listDir(cacheDir).length;
                this.logger.info('[SYSTEM] 캐시 정리 시작', { 
                    path: cacheDir, 
                    fileCount 
                });
                
                files.removeDir(cacheDir);
                files.ensureDir(cacheDir + '/');
                
                return {
                    cleared: true,
                    timestamp: Date.now(),
                    files_deleted: fileCount
                };
            }

            return {
                cleared: true,
                timestamp: Date.now(),
                files_deleted: 0,
                note: '캐시 디렉토리가 이미 비어있음'
            };

        } catch (e) {
            this.logger.error('[SYSTEM] 캐시 정리 실패', { error: e.message });
            return { cleared: false, error: e.message };
        }
    }

    /**
     * SCREENSHOT 처리 - 스크린샷 캡처
     * 
     * 개선사항:
     * - 타임아웃 처리 추가
     * - captureScreen 함수 존재 확인
     * - 업로드 구현 추가
     */
    async _handleScreenshot(config) {
        const quality = config?.quality || 50;
        const maxWidth = config?.max_width || 480;
        const uploadEndpoint = config?.upload_endpoint;

        this.logger.debug('[SYSTEM] 스크린샷 캡처', { quality, maxWidth });

        try {
            // 권한 요청 (타임아웃 처리)
            const permissionGranted = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('화면 캡처 권한 요청 타임아웃'));
                }, SCREEN_CAPTURE_TIMEOUT_MS);
                
                try {
                    const result = requestScreenCapture(false);
                    clearTimeout(timeout);
                    resolve(result);
                } catch (e) {
                    clearTimeout(timeout);
                    reject(e);
                }
            });
            
            if (!permissionGranted) {
                return { captured: false, error: '화면 캡처 권한 없음' };
            }

            await asyncDelay(SCREEN_CAPTURE_SETTLE_MS);

            // captureScreen 함수 존재 확인
            if (typeof captureScreen !== 'function') {
                return { captured: false, error: 'captureScreen 함수 없음' };
            }

            // 스크린샷 캡처
            const img = captureScreen();
            if (!img) {
                return { captured: false, error: '캡처 실패' };
            }

            // 이미지 너비 검증 (0 또는 falsy 체크)
            const imgWidth = img.getWidth();
            if (!imgWidth || imgWidth <= 0) {
                this.logger.warn('[System] 스크린샷 이미지 너비가 잘못됨', { width: imgWidth });
                img.recycle();
                return { captured: false, error: '이미지 너비 오류' };
            }

            // 리사이즈 (너비가 유효한 경우에만)
            const scale = imgWidth <= maxWidth ? 1 : maxWidth / imgWidth;
            const resized = images.scale(img, scale, scale);

            // 저장
            const screenshotDir = '/sdcard/doai/screenshots';
            if (!files.exists(screenshotDir)) {
                files.ensureDir(screenshotDir + '/');
            }

            const filename = `screenshot_${Date.now()}.jpg`;
            const filepath = screenshotDir + '/' + filename;
            
            images.save(resized, filepath, 'jpg', quality);

            // 정리
            img.recycle();
            resized.recycle();

            // 업로드 구현
            if (uploadEndpoint && this.network) {
                try {
                    const uploadResult = await this.network.uploadScreenshot(uploadEndpoint, filepath);
                    this.logger.info('[SYSTEM] 스크린샷 업로드 완료', { 
                        filepath,
                        success: uploadResult 
                    });
                } catch (uploadError) {
                    this.logger.error('[SYSTEM] 스크린샷 업로드 실패', { 
                        error: uploadError.message 
                    });
                }
            }

            return {
                captured: true,
                filepath,
                quality,
                width: maxWidth
            };

        } catch (e) {
            this.logger.error('[SYSTEM] 스크린샷 실패', { error: e.message });
            return { captured: false, error: e.message };
        }
    }
}

module.exports = SystemHandler;
module.exports.SystemCommand = SystemCommand;
module.exports.WakeMethod = WakeMethod;
