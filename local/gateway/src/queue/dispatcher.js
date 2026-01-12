/**
 * Task Dispatcher
 * 작업 배분
 *
 * Aria 명세서 기준:
 * - 기기 선택 알고리즘 (점수 기반)
 * - 특정 AI 시민 지정 시 해당 기기로
 *
 * @author Axon (Tech Lead)
 * @version 1.1.0
 */

const { TaskStatus } = require('./task_queue');

class Dispatcher {
    constructor(logger, commander, deviceTracker, taskQueue, discoveryManager = null) {
        this.logger = logger;
        this.commander = commander;
        this.deviceTracker = deviceTracker;
        this.taskQueue = taskQueue;
        this.discoveryManager = discoveryManager;
        this.interval = null;
        this.dispatchIntervalMs = 1000; // 1초
    }

    /**
     * 디스패처 시작
     */
    start() {
        if (this.interval) {
            this.logger.warn('[Dispatcher] 이미 실행 중');
            return;
        }

        this.logger.info('[Dispatcher] 시작');

        this.interval = setInterval(() => {
            this._processQueue();
        }, this.dispatchIntervalMs);
    }

    /**
     * 디스패처 중지
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.logger.info('[Dispatcher] 중지');
        }
    }

    /**
     * 큐 처리
     */
    async _processQueue() {
        const task = this.taskQueue.getNextPending();
        if (!task) return;

        // 기기 선택
        const device = this._selectDevice(task);
        if (!device) {
            this.logger.debug('[Dispatcher] 가용 기기 없음');
            return;
        }

        // 작업 할당
        this.taskQueue.assign(task.id, device.id);

        // 메시지 전송
        const message = {
            type: task.type,
            priority: task.priority,
            payload: task.payload,
            id: task.id
        };

        const success = await this.commander.send(device.id, message);

        if (!success) {
            this.taskQueue.fail(task.id, 'Send failed');
        } else {
            this.taskQueue.markInProgress(task.id);
            this.logger.info('[Dispatcher] 작업 전송', {
                taskId: task.id,
                deviceId: device.id,
                type: task.type
            });
        }
    }

    /**
     * 기기 선택
     * DiscoveryManager 우선 사용, DeviceTracker 폴백
     */
    _selectDevice(task) {
        // Case 1: 특정 기기 지정
        if (task.payload?.target_device_id) {
            // DiscoveryManager 우선 사용
            if (this.discoveryManager) {
                const device = this.discoveryManager.getDevice(task.payload.target_device_id);
                if (device && device.status === 'ONLINE') {
                    return { id: device.serial, ...device };
                }
            }
            // DeviceTracker 폴백
            const device = this.deviceTracker.getDevice(task.payload.target_device_id);
            if (device && device.status === 'HEALTHY') {
                return device;
            }
            return null; // 지정 기기 불가 시 대기
        }

        // Case 2: 최적 기기 선택 - DiscoveryManager 우선
        let candidates = [];

        if (this.discoveryManager) {
            candidates = this.discoveryManager.getOnlineDevices()
                .map(d => ({ id: d.serial, ...d, status: 'HEALTHY' }))
                .filter(d => this.taskQueue.getDeviceTaskCount(d.id) < 3);

            this.logger.debug('[Dispatcher] DiscoveryManager 디바이스', {
                count: candidates.length,
                devices: candidates.map(d => d.id)
            });
        }

        // DiscoveryManager에서 디바이스가 없으면 DeviceTracker 사용
        if (candidates.length === 0) {
            candidates = this.deviceTracker.getHealthyDevices()
                .filter(d => this.taskQueue.getDeviceTaskCount(d.id) < 3);

            this.logger.debug('[Dispatcher] DeviceTracker 폴백', {
                count: candidates.length
            });
        }

        if (candidates.length === 0) return null;

        // 점수 계산
        const scored = candidates.map(d => ({
            device: d,
            score: this._calculateScore(d, task)
        }));

        // 최고 점수 기기 선택
        scored.sort((a, b) => b.score - a.score);
        return scored[0].device;
    }

    /**
     * 기기 점수 계산
     */
    _calculateScore(device, task) {
        let score = 100;

        // 대기 작업 적을수록 좋음 (-10점/작업)
        const taskCount = this.taskQueue.getDeviceTaskCount(device.id);
        score -= taskCount * 10;

        // 에러율 낮을수록 좋음 (-50점/에러)
        score -= (device.errorCount || 0) * 50;

        // 최근 활동 기기 선호 (+10점)
        const recentMs = 60000; // 1분
        if (device.lastSeen && Date.now() - device.lastSeen < recentMs) {
            score += 10;
        }

        return score;
    }

    /**
     * 즉시 디스패치 (API에서 호출)
     */
    async dispatchImmediate(task) {
        const taskId = this.taskQueue.add(task);

        // 우선순위가 높으면 즉시 처리
        if (task.priority >= 4) {
            await this._processQueue();
        }

        return taskId;
    }
}

module.exports = Dispatcher;
