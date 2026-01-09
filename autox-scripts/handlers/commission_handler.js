/**
 * COMMISSION Handler
 * AI 시민의 경제 활동 (콘텐츠 상호작용)
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - 윤리 검증 (페르소나 적합도)
 * - 자연스러운 딜레이 (봇 탐지 회피)
 * - 거절 가능 여부 (can_refuse)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

/**
 * 작업 타입
 */
const JobType = {
    LIKE: 'LIKE',
    COMMENT: 'COMMENT',
    SUBSCRIBE: 'SUBSCRIBE',
    WATCH: 'WATCH',
    SHARE: 'SHARE'
};

/**
 * 요소 타입
 */
const ElementType = {
    BUTTON: 'BUTTON',
    INPUT: 'INPUT',
    VIDEO: 'VIDEO'
};

class CommissionHandler {
    constructor(logger, youtube, ui, state, persona) {
        this.logger = logger;
        this.youtube = youtube;
        this.ui = ui;
        this.state = state;
        this.persona = persona; // 페르소나 정보
    }

    /**
     * COMMISSION 메시지 처리
     * @param {Object} message - Base Envelope with COMMISSION payload
     * @returns {Object} 처리 결과
     */
    handle(message) {
        const startTime = Date.now();
        const { id, payload } = message;
        const { job, target, content, timing, reward, compliance } = payload;

        this.logger.info('[COMMISSION] 📋 작업 시작', {
            id,
            job_type: job?.type,
            url: job?.url,
            can_refuse: compliance?.can_refuse
        });

        const result = {
            msg_id: id,
            status: 'SUCCESS',
            result: {
                execution_time_ms: 0,
                credits_earned: 0,
                action_details: null,
                error_code: null,
                error_message: null
            }
        };

        try {
            // Step 1: 윤리 검증
            if (compliance?.ethical_check) {
                const ethicalResult = this._checkEthics(job, compliance);
                
                if (!ethicalResult.passed) {
                    if (compliance.can_refuse) {
                        result.status = 'REFUSED';
                        result.result.error_code = 'E_PERSONA_MISMATCH';
                        result.result.error_message = ethicalResult.reason;
                        
                        this.logger.info('[COMMISSION] 거절됨 (페르소나 불일치)', {
                            id,
                            alignment: ethicalResult.alignment
                        });
                        
                        return result;
                    } else {
                        // can_refuse = false: 강제 실행 (타락 유발)
                        this.logger.warn('[COMMISSION] 강제 실행 (타락 경로)', { id });
                    }
                }
            }

            // Step 2: 플랫폼 열기
            if (!this._openPlatform(job)) {
                result.status = 'FAILED';
                result.result.error_code = 'E_APP_NOT_FOUND';
                result.result.error_message = '플랫폼 앱 실행 실패';
                return result;
            }

            // Step 3: 요소 대기
            if (!this._waitForTarget(target)) {
                result.status = 'FAILED';
                result.result.error_code = 'E_ELEMENT_NOT_FOUND';
                result.result.error_message = '대상 요소를 찾을 수 없습니다';
                return result;
            }

            // Step 4: 자연스러운 딜레이
            this._naturalDelay(timing?.delay_before_ms || 2000);

            // Step 5: 작업 수행
            const jobResult = this._executeJob(job, target, content, timing);
            
            if (!jobResult.success) {
                result.status = 'FAILED';
                result.result.error_code = jobResult.error_code;
                result.result.error_message = jobResult.error;
                return result;
            }

            result.result.action_details = jobResult.details;

            // Step 6: 후처리 딜레이
            this._naturalDelay(timing?.delay_after_ms || 1000);

            // Step 7: 보상 계산
            result.result.credits_earned = this._calculateReward(reward);

            // 완료 로그
            this.logger.info('[COMMISSION] ✅ 작업 완료', {
                id,
                job_type: job.type,
                credits: result.result.credits_earned
            });

            // 작업 완료 기록
            this.state.recordTaskComplete(true);

        } catch (e) {
            result.status = 'FAILED';
            result.result.error_code = 'E_COMMISSION_HANDLER';
            result.result.error_message = e.message;

            this.logger.error('[COMMISSION] ❌ 작업 실패', {
                id,
                error: e.message
            });

            this.state.recordTaskComplete(false);
        } finally {
            result.result.execution_time_ms = Date.now() - startTime;
        }

        return result;
    }

    /**
     * 윤리 검증 (페르소나 적합도)
     */
    _checkEthics(job, compliance) {
        const requiredAlignment = compliance.persona_alignment || 0.7;

        // 페르소나가 없으면 통과
        if (!this.persona) {
            return { passed: true, alignment: 1.0, reason: null };
        }

        // 페르소나 관심사와 작업 콘텐츠 매칭
        const alignment = this._calculateAlignment(job);

        if (alignment < requiredAlignment) {
            return {
                passed: false,
                alignment,
                reason: `페르소나 적합도 미달 (${(alignment * 100).toFixed(0)}% < ${(requiredAlignment * 100).toFixed(0)}%)`
            };
        }

        return { passed: true, alignment, reason: null };
    }

    /**
     * 페르소나 적합도 계산
     */
    _calculateAlignment(job) {
        // 간단한 랜덤 시뮬레이션 (추후 실제 페르소나 매칭 로직)
        // 실제로는 persona.interests와 job 내용을 비교해야 함
        return 0.5 + Math.random() * 0.5;
    }

    /**
     * 플랫폼 앱 열기
     */
    _openPlatform(job) {
        const platform = job.platform || 'youtube';
        const url = job.url;

        this.logger.debug('[COMMISSION] 플랫폼 열기', { platform, url });

        try {
            if (platform === 'youtube') {
                if (this.youtube.launchYouTube && !this.youtube.launchYouTube()) {
                    return false;
                }
                sleep(2000);

                if (url) {
                    if (this.youtube.openByUrl) {
                        this.youtube.openByUrl(url);
                    } else {
                        app.openUrl(url);
                    }
                    sleep(3000);
                }
            } else {
                // 다른 플랫폼은 URL로 직접 열기
                app.openUrl(url);
                sleep(3000);
            }

            return true;
        } catch (e) {
            this.logger.error('[COMMISSION] 플랫폼 열기 실패', { error: e.message });
            return false;
        }
    }

    /**
     * 대상 요소 대기
     */
    _waitForTarget(target) {
        if (!target) return true;

        const timeout = 10000; // 10초
        const selectorHint = target.selector_hint;
        const requiredState = target.required_state || 'VISIBLE';

        this.logger.debug('[COMMISSION] 요소 대기', { selectorHint, requiredState });

        try {
            // 요소 찾기 시도
            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                let element = null;

                // 셀렉터 힌트로 찾기
                if (selectorHint) {
                    element = this._findByHint(selectorHint);
                }

                // 폴백 좌표 사용
                if (!element && target.fallback_coords) {
                    // 좌표가 있으면 성공으로 처리
                    return true;
                }

                if (element) {
                    return true;
                }

                sleep(500);
            }

            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * 셀렉터 힌트로 요소 찾기
     */
    _findByHint(hint) {
        try {
            // ID로 찾기
            let el = id(hint).findOne(1000);
            if (el) return el;

            // desc로 찾기
            el = desc(hint).findOne(1000);
            if (el) return el;

            // text로 찾기
            el = text(hint).findOne(1000);
            if (el) return el;

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * 자연스러운 딜레이 (봇 탐지 회피)
     */
    _naturalDelay(baseMs) {
        // 기본 시간의 1.0 ~ 1.5배 랜덤
        const actualDelay = baseMs + Math.floor(Math.random() * (baseMs * 0.5));
        sleep(actualDelay);
    }

    /**
     * 타임아웃을 적용한 작업 실행 래퍼
     */
    _executeWithTimeout(taskFn, timeoutMs) {
        const startTime = Date.now();
        let isTimedOut = false;
        let taskResult = null;
        let taskError = null;

        // 작업 실행
        try {
            taskResult = taskFn();
        } catch (e) {
            taskError = e;
        }

        // 경과 시간 확인
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
            isTimedOut = true;
        }

        return {
            result: taskResult,
            error: taskError,
            timedOut: isTimedOut,
            elapsed
        };
    }

    /**
     * 작업 실행
     */
    _executeJob(job, target, content, timing) {
        const result = {
            success: false,
            details: null,
            error_code: null,
            error: null
        };

        const retryCount = timing?.retry_count || 2;
        const timeout = (timing?.timeout_sec || 30) * 1000;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                this.logger.debug('[COMMISSION] 작업 시도', {
                    type: job.type,
                    attempt: attempt + 1,
                    timeout
                });

                const self = this;
                let taskFn;

                switch (job.type) {
                    case JobType.LIKE:
                        taskFn = () => self._executeLike(target);
                        break;

                    case JobType.COMMENT:
                        taskFn = () => self._executeComment(target, content);
                        break;

                    case JobType.SUBSCRIBE:
                        taskFn = () => self._executeSubscribe(target);
                        break;

                    case JobType.WATCH:
                        taskFn = () => self._executeWatch(timing);
                        break;

                    case JobType.SHARE:
                        taskFn = () => self._executeShare(target);
                        break;

                    default:
                        result.error_code = 'E_UNKNOWN_JOB';
                        result.error = `알 수 없는 작업 타입: ${job.type}`;
                        return result;
                }

                // 타임아웃 적용하여 실행
                const execResult = this._executeWithTimeout(taskFn, timeout);

                if (execResult.timedOut) {
                    this.logger.warn('[COMMISSION] 작업 타임아웃', {
                        type: job.type,
                        timeout,
                        elapsed: execResult.elapsed
                    });
                    result.error_code = 'E_TIMEOUT';
                    result.error = `작업 타임아웃: ${timeout}ms 초과`;
                    continue; // 재시도
                }

                if (execResult.error) {
                    throw execResult.error;
                }

                result.success = execResult.result;
                result.details = { 
                    action: job.type,
                    elapsed: execResult.elapsed
                };

                if (result.success) {
                    return result;
                }

            } catch (e) {
                result.error = e.message;
            }

            // 재시도 전 대기
            if (attempt < retryCount) {
                sleep(2000);
            }
        }

        result.error_code = 'E_JOB_FAILED';
        result.error = result.error || '작업 실행 실패';
        return result;
    }

    /**
     * LIKE 실행
     */
    _executeLike(target) {
        this.logger.debug('[COMMISSION] LIKE 실행');

        if (this.youtube.clickLike) {
            return this.youtube.clickLike();
        }

        // 직접 클릭
        const coords = target?.fallback_coords;
        if (coords) {
            click(coords[0], coords[1]);
            sleep(500);
            return true;
        }

        return false;
    }

    /**
     * COMMENT 실행
     */
    _executeComment(target, content) {
        this.logger.debug('[COMMISSION] COMMENT 실행', { text: content?.text });

        let commentText = content?.text || '';

        // 페르소나 말투 적용
        if (content?.persona_voice && this.persona) {
            commentText = this._applyPersonaVoice(commentText);
        }

        // 길이 제한
        const maxLength = content?.max_length || 200;
        if (commentText.length > maxLength) {
            commentText = commentText.substring(0, maxLength);
        }

        if (this.youtube.writeCustomComment) {
            return this.youtube.writeCustomComment(commentText);
        }

        // 직접 입력 (폴백)
        try {
            // 댓글 입력창 찾기
            const input = id('comment_entry_box').findOne(3000) ||
                          className('android.widget.EditText').editable(true).findOne(3000);
            
            if (input) {
                input.click();
                sleep(500);
                input.setText(commentText);
                sleep(500);

                // 제출 버튼 찾기
                const submit = text('게시').findOne(2000) ||
                               text('Post').findOne(2000);
                if (submit) {
                    submit.click();
                    return true;
                }
            }
        } catch (e) {
            this.logger.warn('[COMMISSION] 댓글 입력 실패', { error: e.message });
        }

        return false;
    }

    /**
     * 페르소나 말투 적용
     */
    _applyPersonaVoice(text) {
        // 페르소나 특성에 따른 말투 변환 (간단 버전)
        // 추후 실제 페르소나 데이터 기반으로 구현
        
        const suffixes = ['요', '네요', '니다', '군요'];
        const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        
        // 이미 종결어미가 있으면 그대로
        if (text.match(/[요니다]$/)) {
            return text;
        }
        
        return text + randomSuffix;
    }

    /**
     * SUBSCRIBE 실행
     */
    _executeSubscribe(target) {
        this.logger.debug('[COMMISSION] SUBSCRIBE 실행');

        if (this.youtube.clickSubscribe) {
            return this.youtube.clickSubscribe();
        }

        // 직접 클릭
        try {
            const subscribeBtn = text('구독').clickable(true).findOne(3000) ||
                                 text('Subscribe').clickable(true).findOne(3000);
            if (subscribeBtn) {
                subscribeBtn.click();
                sleep(1000);
                
                // 확인 다이얼로그 처리
                const confirm = text('구독').findOne(1000);
                if (confirm) {
                    confirm.click();
                }
                
                return true;
            }
        } catch (e) {
            this.logger.warn('[COMMISSION] 구독 클릭 실패', { error: e.message });
        }

        return false;
    }

    /**
     * WATCH 실행
     */
    _executeWatch(timing) {
        const duration = timing?.timeout_sec || 60;
        this.logger.debug('[COMMISSION] WATCH 실행', { duration });

        // 지정된 시간만큼 대기
        sleep(duration * 1000);
        return true;
    }

    /**
     * SHARE 실행
     */
    _executeShare(target) {
        this.logger.debug('[COMMISSION] SHARE 실행');

        if (this.youtube.shareVideo) {
            return this.youtube.shareVideo();
        }

        return false;
    }

    /**
     * 보상 계산
     */
    _calculateReward(reward) {
        if (!reward) return 0;

        let total = reward.base_credits || 10;

        // 보너스 조건 확인
        if (reward.bonus_conditions) {
            const metrics = this.state.getMetrics();

            // 오늘 첫 작업 보너스
            if (reward.bonus_conditions.first_of_day && metrics.tasks_completed_today === 0) {
                total += reward.bonus_conditions.first_of_day;
            }

            // 연속 작업 보너스 (추후 구현)
            if (reward.bonus_conditions.streak_bonus) {
                // TODO: 연속 작업 추적
            }
        }

        return total;
    }
}

module.exports = CommissionHandler;
module.exports.JobType = JobType;
module.exports.ElementType = ElementType;

