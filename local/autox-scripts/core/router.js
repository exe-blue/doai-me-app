/**
 * DoAi-Client Router Module
 * 수신된 메시지를 적절한 핸들러로 라우팅
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - Priority Queue 적용
 * - priority 5 = 즉시 처리
 * - priority 1-2 = 대기열에 추가
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

const { MessageType, Priority } = require('./receiver.js');

/**
 * Priority Queue 구현
 * 높은 priority가 먼저 처리됨
 */
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    /**
     * 메시지 추가 (우선순위 정렬)
     */
    enqueue(message) {
        const item = {
            message,
            priority: message.priority,
            enqueuedAt: Date.now()
        };

        // 우선순위 내림차순으로 삽입 위치 찾기
        let added = false;
        for (let i = 0; i < this.items.length; i++) {
            if (item.priority > this.items[i].priority) {
                this.items.splice(i, 0, item);
                added = true;
                break;
            }
        }

        if (!added) {
            this.items.push(item);
        }
    }

    /**
     * 가장 높은 우선순위 메시지 추출
     */
    dequeue() {
        if (this.isEmpty()) return null;
        return this.items.shift().message;
    }

    /**
     * 다음 메시지 확인 (제거하지 않음)
     */
    peek() {
        if (this.isEmpty()) return null;
        return this.items[0].message;
    }

    /**
     * 대기열 비어있는지 확인
     */
    isEmpty() {
        return this.items.length === 0;
    }

    /**
     * 대기열 크기
     */
    size() {
        return this.items.length;
    }

    /**
     * TTL 만료된 메시지 제거
     */
    pruneExpired() {
        const now = Date.now();
        const before = this.items.length;
        
        this.items = this.items.filter(item => {
            const message = item.message;
            if (!message.ttl) return true;
            
            const expiresAt = message.ts + (message.ttl * 1000);
            return now < expiresAt;
        });
        
        return before - this.items.length;
    }

    /**
     * 대기열 상태
     */
    getStats() {
        const byPriority = {};
        for (const item of this.items) {
            byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
        }
        return {
            total: this.items.length,
            byPriority
        };
    }
}

/**
 * 동시성 제한을 위한 간단한 세마포어
 */
class Semaphore {
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.currentCount = 0;
        this.waitingQueue = [];
    }

    acquire() {
        return new Promise((resolve) => {
            if (this.currentCount < this.maxConcurrency) {
                this.currentCount++;
                resolve();
            } else {
                this.waitingQueue.push(resolve);
            }
        });
    }

    release() {
        // release()가 acquire() 없이 호출되면 currentCount가 음수가 되는 것을 방지
        if (this.waitingQueue.length > 0) {
            // 대기 중인 요청이 있으면 permit을 넘김 (currentCount 변경 없음)
            const next = this.waitingQueue.shift();
            next();
        } else {
            // 대기 중인 요청이 없으면 currentCount 감소 (최소 0으로 clamp)
            this.currentCount = Math.max(0, this.currentCount - 1);
        }
    }

    getStats() {
        return {
            active: this.currentCount,
            waiting: this.waitingQueue.length,
            maxConcurrency: this.maxConcurrency
        };
    }
}

class Router {
    constructor(logger, state) {
        this.logger = logger;
        this.state = state;
        this.queue = new PriorityQueue();
        this.handlers = {};
        this.isProcessing = false;
        
        // 처리 루프 간격 (ms)
        this.processInterval = 100;
        this.processTimer = null;
        
        // 스레드 풀 동시성 제한 (최대 4개 동시 실행)
        this.MAX_CONCURRENT_HANDLERS = 4;
        this.semaphore = new Semaphore(this.MAX_CONCURRENT_HANDLERS);
    }

    /**
     * 핸들러 등록
     * @param {string} type - 메시지 타입 (POP, ACCIDENT, COMMISSION, SYSTEM)
     * @param {Object} handler - 핸들러 인스턴스 (handle 메서드 필요)
     */
    registerHandler(type, handler) {
        if (!handler || typeof handler.handle !== 'function') {
            throw new Error(`Invalid handler for type: ${type}`);
        }
        this.handlers[type] = handler;
        this.logger.info(`[Router] 핸들러 등록: ${type}`);
    }

    /**
     * 메시지 라우팅
     * @param {Object} message - Base Envelope
     */
    route(message) {
        const { type, priority, id } = message;

        this.logger.debug('[Router] 메시지 수신', {
            id,
            type,
            priority
        });

        // CRITICAL (5) 또는 URGENT (4)는 즉시 처리
        if (priority >= Priority.URGENT) {
            this.logger.info(`[Router] 즉시 처리 (priority=${priority})`, { id });
            this._processImmediately(message);
            return;
        }

        // 나머지는 대기열에 추가
        this.queue.enqueue(message);
        this.logger.debug('[Router] 대기열 추가', {
            id,
            queueSize: this.queue.size()
        });
    }

    /**
     * 즉시 처리 (현재 작업 중단)
     */
    _processImmediately(message) {
        const { type, priority } = message;

        // CRITICAL은 현재 작업 중단
        if (priority === Priority.CRITICAL) {
            this.logger.warn('[Router] ⚠️ CRITICAL - 현재 작업 중단');
            this.state.interruptCurrent();
        }

        // 핸들러 실행
        this._dispatch(message);
    }

    /**
     * 핸들러에 메시지 전달 (동시성 제한 적용)
     */
    _dispatch(message) {
        const { type, id } = message;
        const handler = this.handlers[type];

        if (!handler) {
            this.logger.error(`[Router] 핸들러 없음: ${type}`, { id });
            return;
        }

        // 백프레셔: 대기열이 포화 상태면 경고 로깅
        const poolStats = this.semaphore.getStats();
        if (poolStats.waiting > this.MAX_CONCURRENT_HANDLERS * 2) {
            this.logger.warn(`[Router] 스레드 풀 포화 상태`, {
                active: poolStats.active,
                waiting: poolStats.waiting
            });
        }

        // 현재 작업으로 설정
        this.state.setCurrentTask({
            id,
            type,
            status: 'IN_PROGRESS',
            startedAt: Date.now()
        });

        // 동시성 제한 적용하여 핸들러 실행
        const self = this;
        this.semaphore.acquire().then(function() {
            threads.start(function() {
                try {
                    self.logger.info(`[Router] 핸들러 실행: ${type}`, { id });
                    
                    let result;
                    // 핸들러가 async인 경우 대기 처리
                    const handlerResult = handler.handle(message);
                    if (handlerResult && typeof handlerResult.then === 'function') {
                        // Promise인 경우 결과를 기다림 (AutoX.js threads 환경)
                        try {
                            result = handlerResult.waitFor ? handlerResult.waitFor() : handlerResult;
                            // Promise가 resolve될 때까지 대기 (동기적 환경 호환)
                            if (result && typeof result.then === 'function') {
                                // fallback: Promise가 아직 resolve되지 않은 경우
                                result = { status: 'PENDING', message: 'Handler returned unresolved Promise' };
                            }
                        } catch (promiseError) {
                            result = {
                                status: 'FAILED',
                                error_code: 'E_PROMISE_REJECTED',
                                error_message: promiseError.message || 'Promise rejected'
                            };
                        }
                    } else {
                        result = handlerResult || { status: 'SUCCESS' };
                    }
                    
                    self.logger.info(`[Router] 핸들러 완료: ${type}`, { 
                        id,
                        result: result ? result.status : 'unknown'
                    });

                    // ACK 필요 시 응답
                    if (message.ack_required) {
                        self._sendAck(message, result);
                    }

                } catch (e) {
                    self.logger.error(`[Router] 핸들러 오류: ${type}`, {
                        id,
                        error: e.message,
                        stack: e.stack
                    });

                    if (message.ack_required) {
                        self._sendAck(message, {
                            status: 'FAILED',
                            error_code: 'E_HANDLER_ERROR',
                            error_message: e.message
                        });
                    }
                } finally {
                    self.state.clearCurrentTask();
                    self.semaphore.release();
                }
            });
        });
    }

    /**
     * ACK 응답 전송
     */
    _sendAck(originalMessage, result) {
        // network.js에서 처리 (추후 구현)
        this.logger.debug('[Router] ACK 전송 예정', {
            msg_id: originalMessage.id,
            status: result?.status
        });
    }

    /**
     * 대기열 처리 시작
     */
    startProcessing() {
        if (this.processTimer) return;

        this.logger.info('[Router] 대기열 처리 시작');
        
        const self = this;
        this.processTimer = setInterval(function() {
            self._processQueue();
        }, this.processInterval);
    }

    /**
     * 대기열 처리 중지
     */
    stopProcessing() {
        if (this.processTimer) {
            clearInterval(this.processTimer);
            this.processTimer = null;
            this.logger.info('[Router] 대기열 처리 중지');
        }
    }

    /**
     * 대기열에서 메시지 처리
     */
    _processQueue() {
        // 현재 작업 중이면 대기
        if (this.state.isBusy()) {
            return;
        }

        // 만료된 메시지 정리
        const pruned = this.queue.pruneExpired();
        if (pruned > 0) {
            this.logger.debug(`[Router] 만료 메시지 제거: ${pruned}개`);
        }

        // 다음 메시지 처리
        const message = this.queue.dequeue();
        if (message) {
            this._dispatch(message);
        }
    }

    /**
     * 대기열 상태
     */
    getQueueStats() {
        return this.queue.getStats();
    }
}

module.exports = Router;
module.exports.PriorityQueue = PriorityQueue;

