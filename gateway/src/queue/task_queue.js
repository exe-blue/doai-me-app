/**
 * Task Queue
 * 작업 대기열 관리
 * 
 * Aria 명세서 기준:
 * - 모든 할당된 작업은 Gateway에서 관리
 * - 상태: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, FAILED, ORPHANED
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 작업 상태
 */
const TaskStatus = {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    ORPHANED: 'ORPHANED'
};

class TaskQueue {
    constructor(logger) {
        this.logger = logger;
        this.tasks = new Map(); // id -> Task
        this.deviceTasks = new Map(); // deviceId -> Set<taskId>
    }

    /**
     * 작업 추가
     */
    add(task) {
        const id = task.id || uuidv4();
        
        const queuedTask = {
            id,
            type: task.type,
            priority: task.priority || 2,
            payload: task.payload,
            status: TaskStatus.PENDING,
            createdAt: Date.now(),
            assignedTo: null,
            assignedAt: null,
            completedAt: null,
            result: null,
            retryCount: 0,
            maxRetries: task.maxRetries || 2
        };

        this.tasks.set(id, queuedTask);
        this.logger.debug('[Queue] 작업 추가', { id, type: task.type });

        return id;
    }

    /**
     * 작업 할당
     */
    assign(taskId, deviceId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            this.logger.warn('[Queue] 작업 없음', { taskId });
            return false;
        }

        task.status = TaskStatus.ASSIGNED;
        task.assignedTo = deviceId;
        task.assignedAt = Date.now();

        // 기기별 작업 매핑
        if (!this.deviceTasks.has(deviceId)) {
            this.deviceTasks.set(deviceId, new Set());
        }
        this.deviceTasks.get(deviceId).add(taskId);

        this.logger.debug('[Queue] 작업 할당', { taskId, deviceId });
        return true;
    }

    /**
     * 작업 시작 표시
     */
    markInProgress(taskId) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = TaskStatus.IN_PROGRESS;
        }
    }

    /**
     * 작업 완료
     */
    complete(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.status = TaskStatus.COMPLETED;
        task.completedAt = Date.now();
        task.result = result;

        // 기기별 매핑에서 제거
        if (task.assignedTo) {
            const deviceSet = this.deviceTasks.get(task.assignedTo);
            if (deviceSet) {
                deviceSet.delete(taskId);
            }
        }

        this.logger.debug('[Queue] 작업 완료', { taskId });
        return true;
    }

    /**
     * 작업 실패
     */
    fail(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.retryCount++;

        if (task.retryCount <= task.maxRetries) {
            // 재시도 가능
            task.status = TaskStatus.PENDING;
            task.assignedTo = null;
            task.assignedAt = null;
            this.logger.warn('[Queue] 작업 재시도', { 
                taskId, 
                retry: task.retryCount 
            });
        } else {
            // 최대 재시도 초과
            task.status = TaskStatus.FAILED;
            task.completedAt = Date.now();
            task.result = { error };
            this.logger.error('[Queue] 작업 실패', { taskId, error });
        }

        // 기기별 매핑에서 제거
        if (task.assignedTo) {
            const deviceSet = this.deviceTasks.get(task.assignedTo);
            if (deviceSet) {
                deviceSet.delete(taskId);
            }
        }

        return true;
    }

    /**
     * 기기 장애로 인한 Orphan 처리
     */
    orphanByDevice(deviceId) {
        const taskSet = this.deviceTasks.get(deviceId);
        if (!taskSet) return 0;

        let count = 0;
        for (const taskId of taskSet) {
            const task = this.tasks.get(taskId);
            if (task && task.status !== TaskStatus.COMPLETED) {
                task.status = TaskStatus.ORPHANED;
                task.orphanedAt = Date.now();
                count++;
            }
        }

        this.deviceTasks.delete(deviceId);
        this.logger.warn('[Queue] Orphan 처리', { deviceId, count });

        return count;
    }

    /**
     * 다음 대기 작업 가져오기 (우선순위 기준)
     */
    getNextPending() {
        let bestTask = null;

        for (const task of this.tasks.values()) {
            if (task.status !== TaskStatus.PENDING) continue;

            if (!bestTask || task.priority > bestTask.priority) {
                bestTask = task;
            }
        }

        return bestTask;
    }

    /**
     * 특정 기기에 할당된 작업 수
     */
    getDeviceTaskCount(deviceId) {
        const taskSet = this.deviceTasks.get(deviceId);
        return taskSet ? taskSet.size : 0;
    }

    /**
     * 작업 조회
     */
    get(taskId) {
        return this.tasks.get(taskId) || null;
    }

    /**
     * 전체 통계
     */
    getStats() {
        const stats = {
            total: this.tasks.size,
            byStatus: {}
        };

        for (const status of Object.values(TaskStatus)) {
            stats.byStatus[status] = 0;
        }

        for (const task of this.tasks.values()) {
            stats.byStatus[task.status]++;
        }

        return stats;
    }

    /**
     * 완료된 작업 정리 (오래된 것)
     */
    cleanup(maxAgeMs = 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAgeMs;
        let removed = 0;

        for (const [id, task] of this.tasks) {
            if (task.status === TaskStatus.COMPLETED || 
                task.status === TaskStatus.FAILED) {
                if (task.completedAt && task.completedAt < cutoff) {
                    this.tasks.delete(id);
                    removed++;
                }
            }
        }

        if (removed > 0) {
            this.logger.info('[Queue] 정리 완료', { removed });
        }

        return removed;
    }
}

module.exports = TaskQueue;
module.exports.TaskStatus = TaskStatus;

