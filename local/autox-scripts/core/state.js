/**
 * DoAi-Client State Manager
 * 기기 상태 관리 및 영속성
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - 메모리: 현재 상태 (빠른 접근)
 * - 파일: /sdcard/doai/state.json (재부팅 복구용)
 * - 주기: 상태 변경 시 + 30초 간격 자동 저장
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

const STATE_FILE_PATH = '/sdcard/doai/state.json';
const AUTO_SAVE_INTERVAL = 30000; // 30초

/**
 * 기본 상태 템플릿
 */
function getDefaultState() {
    return {
        device: {
            id: device.serial || 'unknown',
            ai_citizen_id: null,
            persona_name: null,
            boot_time: Date.now(),
            config_version: '1.0.0'
        },
        current_task: null,
        queue: [],
        metrics: {
            last_heartbeat: null,
            tasks_completed_today: 0,
            tasks_failed_today: 0,
            error_count: 0,
            uptime_sec: 0
        },
        flags: {
            is_busy: false,
            is_healthy: true,
            needs_restart: false,
            debug_mode: false
        }
    };
}

class StateManager {
    constructor(logger) {
        this.logger = logger;
        this.state = getDefaultState();
        this.isDirty = false;
        this.saveTimer = null;
        this.uptimeTimer = null;
        this.bootTime = Date.now();
    }

    /**
     * 초기화 - 저장된 상태 복구
     */
    initialize() {
        this._loadFromFile();
        this._startAutoSave();
        this._startUptimeTracker();
        
        // 부팅 시간 업데이트
        this.state.device.boot_time = this.bootTime;
        this.state.device.id = device.serial || 'unknown';
        
        this.logger.info('[State] 초기화 완료', {
            device_id: this.state.device.id,
            restored: this.state.metrics.last_heartbeat !== null
        });
    }

    /**
     * 파일에서 상태 로드
     */
    _loadFromFile() {
        try {
            if (files.exists(STATE_FILE_PATH)) {
                const content = files.read(STATE_FILE_PATH);
                const saved = JSON.parse(content);
                
                // 저장된 상태 병합 (일부 필드만)
                if (saved.device?.ai_citizen_id) {
                    this.state.device.ai_citizen_id = saved.device.ai_citizen_id;
                    this.state.device.persona_name = saved.device.persona_name;
                }
                if (saved.metrics) {
                    this.state.metrics.tasks_completed_today = saved.metrics.tasks_completed_today || 0;
                    this.state.metrics.tasks_failed_today = saved.metrics.tasks_failed_today || 0;
                }
                
                this.logger.info('[State] 파일에서 복구됨', {
                    path: STATE_FILE_PATH
                });
            }
        } catch (e) {
            this.logger.warn('[State] 파일 로드 실패', { error: e.message });
        }
    }

    /**
     * 파일에 상태 저장
     */
    _saveToFile() {
        if (!this.isDirty) return;
        
        try {
            // 디렉토리 확인
            const dir = STATE_FILE_PATH.substring(0, STATE_FILE_PATH.lastIndexOf('/'));
            if (!files.exists(dir)) {
                files.ensureDir(dir + '/');
            }
            
            const content = JSON.stringify(this.state, null, 2);
            files.write(STATE_FILE_PATH, content);
            
            this.isDirty = false;
            this.logger.debug('[State] 파일 저장됨');
        } catch (e) {
            this.logger.error('[State] 파일 저장 실패', { error: e.message });
        }
    }

    /**
     * 자동 저장 시작
     */
    _startAutoSave() {
        const self = this;
        this.saveTimer = setInterval(function() {
            self._saveToFile();
        }, AUTO_SAVE_INTERVAL);
    }

    /**
     * Uptime 추적 시작
     */
    _startUptimeTracker() {
        const self = this;
        this.uptimeTimer = setInterval(function() {
            self.state.metrics.uptime_sec = Math.floor((Date.now() - self.bootTime) / 1000);
        }, 1000);
    }

    /**
     * 종료 처리
     */
    shutdown() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
        }
        this._saveToFile();
        this.logger.info('[State] 종료, 상태 저장됨');
    }

    // ==================== Getter ====================

    /**
     * 전체 상태 반환
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 기기 정보 반환
     */
    getDevice() {
        return { ...this.state.device };
    }

    /**
     * 현재 작업 반환
     */
    getCurrentTask() {
        return this.state.current_task ? { ...this.state.current_task } : null;
    }

    /**
     * 메트릭 반환
     */
    getMetrics() {
        return { ...this.state.metrics };
    }

    /**
     * 바쁜 상태인지 확인
     */
    isBusy() {
        return this.state.flags.is_busy || this.state.current_task !== null;
    }

    /**
     * 건강 상태인지 확인
     */
    isHealthy() {
        return this.state.flags.is_healthy;
    }

    // ==================== Setter ====================

    /**
     * 기기 정보 설정
     */
    setDeviceInfo(info) {
        Object.assign(this.state.device, info);
        this.isDirty = true;
    }

    /**
     * 현재 작업 설정
     */
    setCurrentTask(task) {
        this.state.current_task = task ? {
            id: task.id,
            type: task.type,
            status: task.status || 'IN_PROGRESS',
            startedAt: task.startedAt || Date.now(),
            timeoutAt: task.timeoutAt || null
        } : null;
        
        this.state.flags.is_busy = task !== null;
        this.isDirty = true;
        
        this.logger.debug('[State] 현재 작업 설정', { task_id: task?.id });
    }

    /**
     * 현재 작업 해제
     */
    clearCurrentTask() {
        this.state.current_task = null;
        this.state.flags.is_busy = false;
        this.isDirty = true;
    }

    /**
     * 현재 작업 중단 (CRITICAL 메시지용)
     */
    interruptCurrent() {
        if (this.state.current_task) {
            this.logger.warn('[State] 현재 작업 중단됨', {
                task_id: this.state.current_task.id
            });
        }
        this.clearCurrentTask();
    }

    /**
     * Heartbeat 업데이트
     */
    updateHeartbeat() {
        this.state.metrics.last_heartbeat = Date.now();
        this.isDirty = true;
    }

    /**
     * 작업 완료 기록
     */
    recordTaskComplete(success = true) {
        if (success) {
            this.state.metrics.tasks_completed_today++;
        } else {
            this.state.metrics.tasks_failed_today++;
        }
        this.isDirty = true;
    }

    /**
     * 에러 카운트 증가
     */
    incrementErrorCount() {
        this.state.metrics.error_count++;
        this.isDirty = true;
    }

    /**
     * 에러 카운트 리셋
     */
    resetErrorCount() {
        this.state.metrics.error_count = 0;
        this.isDirty = true;
    }

    /**
     * 플래그 설정
     */
    setFlag(flag, value) {
        if (this.state.flags.hasOwnProperty(flag)) {
            this.state.flags[flag] = value;
            this.isDirty = true;
        }
    }

    /**
     * 일일 메트릭 리셋 (자정에 호출)
     */
    resetDailyMetrics() {
        this.state.metrics.tasks_completed_today = 0;
        this.state.metrics.tasks_failed_today = 0;
        this.isDirty = true;
        this.logger.info('[State] 일일 메트릭 리셋');
    }

    /**
     * Heartbeat 응답용 메트릭 수집
     */
    collectMetricsForHeartbeat() {
        return {
            cpu_usage: null, // AutoX.js에서 측정 어려움
            memory_free_mb: Math.floor(java.lang.Runtime.getRuntime().freeMemory() / (1024 * 1024)),
            battery_level: null, // Phone Board는 null
            uptime_sec: this.state.metrics.uptime_sec,
            pending_tasks: this.state.queue.length
        };
    }
}

module.exports = StateManager;
module.exports.STATE_FILE_PATH = STATE_FILE_PATH;

