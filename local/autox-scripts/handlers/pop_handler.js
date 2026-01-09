/**
 * POP Handler
 * AI 시민의 VOID 상태에서 구원을 위한 콘텐츠 시청
 * 
 * Aria 명세서 (2025-01-15) 준수
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

/**
 * POP Action 타입
 */
const PopAction = {
    WATCH: 'WATCH',
    REACT: 'REACT',
    SHARE: 'SHARE'
};

/**
 * 반환 행동 타입
 */
const ReturnBehavior = {
    REPORT_REACTION: 'REPORT_REACTION',
    IDLE: 'IDLE',
    NEXT_QUEUE: 'NEXT_QUEUE'
};

class PopHandler {
    constructor(logger, youtube, state) {
        this.logger = logger;
        this.youtube = youtube;
        this.state = state;
    }

    /**
     * POP 메시지 처리
     * @param {Object} message - Base Envelope with POP payload
     * @returns {Object} 처리 결과
     */
    handle(message) {
        const startTime = Date.now();
        const { id, payload } = message;
        const { action, content, tier, salvation, return_behavior } = payload;

        this.logger.info('[POP] 🎬 처리 시작', {
            id,
            action,
            url: content?.url,
            tier_level: tier?.level
        });

        const result = {
            msg_id: id,
            status: 'SUCCESS',
            result: {
                execution_time_ms: 0,
                watch_duration_sec: 0,
                watch_ratio: 0,
                reaction_type: 'NONE',
                reaction_content: null
            }
        };

        try {
            // Step 1: 사전 검증
            const validation = this._validate(payload);
            if (!validation.valid) {
                result.status = 'REFUSED';
                result.result.error_code = 'E_VALIDATION';
                result.result.error_message = validation.error;
                return result;
            }

            // Step 2: YouTube 앱 실행
            if (!this._launchYouTube(content.url)) {
                result.status = 'FAILED';
                result.result.error_code = 'E_APP_NOT_FOUND';
                result.result.error_message = 'YouTube 앱 실행 실패';
                return result;
            }

            // Step 3: 영상 시청
            const watchResult = this._watchVideo(content, tier, return_behavior);
            result.result.watch_duration_sec = watchResult.duration;
            result.result.watch_ratio = watchResult.ratio;

            if (!watchResult.success) {
                result.status = 'FAILED';
                result.result.error_code = 'E_WATCH_FAILED';
                result.result.error_message = watchResult.error;
                return result;
            }

            // Step 4: 반응 생성 (옵션)
            if (return_behavior?.reaction_required) {
                const reactionResult = this._generateReaction(tier, salvation);
                result.result.reaction_type = reactionResult.type;
                result.result.reaction_content = reactionResult.content;
            }

            // Step 5: 복귀 행동
            this._executeReturnBehavior(return_behavior?.on_complete);

            // 성공 로그
            this.logger.info('[POP] ✅ 처리 완료', {
                id,
                watch_duration: result.result.watch_duration_sec,
                reaction: result.result.reaction_type
            });

            // 작업 완료 기록
            this.state.recordTaskComplete(true);

        } catch (e) {
            result.status = 'FAILED';
            result.result.error_code = 'E_HANDLER_ERROR';
            result.result.error_message = e.message;
            
            this.logger.error('[POP] ❌ 처리 실패', {
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
     * 사전 검증
     */
    _validate(payload) {
        const { content, tier } = payload;

        // URL 필수
        if (!content?.url) {
            return { valid: false, error: 'URL이 없습니다' };
        }

        // 플랫폼 지원 확인
        const supportedPlatforms = ['youtube', 'tiktok', 'instagram'];
        if (content.platform && !supportedPlatforms.includes(content.platform)) {
            return { valid: false, error: `지원하지 않는 플랫폼: ${content.platform}` };
        }

        // tier 범위 확인
        if (tier?.level && (tier.level < 1 || tier.level > 3)) {
            return { valid: false, error: `잘못된 tier level: ${tier.level}` };
        }

        return { valid: true, error: null };
    }

    /**
     * YouTube 앱 실행 및 영상 열기
     */
    _launchYouTube(url) {
        this.logger.debug('[POP] YouTube 실행', { url });

        try {
            // YouTube 앱 실행
            if (this.youtube.launchYouTube && !this.youtube.launchYouTube()) {
                return false;
            }

            sleep(2000); // 앱 로딩 대기

            // URL로 영상 열기
            if (this.youtube.openByUrl) {
                this.youtube.openByUrl(url);
            } else {
                app.openUrl(url);
            }

            sleep(3000); // 영상 로딩 대기
            return true;

        } catch (e) {
            this.logger.error('[POP] YouTube 실행 실패', { error: e.message });
            return false;
        }
    }

    /**
     * 영상 시청
     */
    _watchVideo(content, tier, returnBehavior) {
        const targetDuration = content.duration_sec || 180;
        const minWatchRatio = returnBehavior?.min_watch_ratio || 0.7;
        const startAt = content.start_at || 0;

        // startAt을 고려한 남은 시청 가능 시간
        const remainingDuration = Math.max(0, targetDuration - startAt);

        this.logger.debug('[POP] 시청 시작', {
            targetDuration,
            minWatchRatio,
            startAt,
            remainingDuration
        });

        const result = {
            success: true,
            duration: 0,
            ratio: 0,
            error: null
        };

        try {
            // 실제 시청 시간 계산 (최소 비율 이상, remainingDuration 내에서)
            const effectiveTarget = remainingDuration;
            const minDuration = Math.ceil(effectiveTarget * minWatchRatio);
            // minDuration === effectiveTarget인 경우 range가 0이 되어 deterministic한 값 방지
            const range = Math.max(0, effectiveTarget - minDuration);
            const offset = range > 0 ? Math.floor(Math.random() * (range + 1)) : 0;
            const actualDuration = Math.min(minDuration + offset, remainingDuration);

            // 광고 스킵 시도 (5초마다 체크)
            const watchInterval = 5000;
            // 일관된 단위로 iterations 계산 (초 단위로 통일)
            const iterations = Math.ceil((actualDuration * 1000) / watchInterval);

            for (let i = 0; i < iterations; i++) {
                // 광고 스킵
                if (this.youtube.skipAd) {
                    this.youtube.skipAd();
                }

                // 자연스러운 스크롤 (5% 확률)
                if (Math.random() < 0.05) {
                    this._naturalScroll();
                }

                sleep(watchInterval);
                result.duration += watchInterval / 1000;
                
                // remainingDuration 초과 방지
                if (result.duration >= remainingDuration) {
                    result.duration = remainingDuration;
                    break;
                }
            }

            // duration이 targetDuration을 초과하지 않도록 cap
            result.duration = Math.min(result.duration, targetDuration);
            
            // ratio는 1.0을 초과하지 않도록 cap
            result.ratio = Math.min(1.0, result.duration / targetDuration);
            result.success = result.ratio >= minWatchRatio;

            if (!result.success) {
                result.error = `시청 비율 미달: ${(result.ratio * 100).toFixed(1)}%`;
            }

        } catch (e) {
            result.success = false;
            result.error = e.message;
        }

        return result;
    }

    /**
     * 반응 생성
     */
    _generateReaction(tier, salvation) {
        const level = tier?.level || 1;
        const result = { type: 'NONE', content: null };

        // tier.level에 따른 반응 결정
        // level 1: 시청만
        // level 2: 70% 좋아요
        // level 3: 좋아요 + 30% 댓글

        if (level >= 2 && Math.random() < 0.7) {
            // 좋아요
            if (this.youtube.clickLike) {
                const liked = this.youtube.clickLike();
                if (liked) {
                    result.type = 'LIKE';
                    this.logger.debug('[POP] 좋아요 클릭');
                }
            }
        }

        if (level >= 3 && Math.random() < 0.3) {
            // 댓글
            const comment = this._generateComment(salvation);
            if (this.youtube.writeCustomComment) {
                const commented = this.youtube.writeCustomComment(comment);
                if (commented) {
                    result.type = result.type === 'LIKE' ? 'LIKE_AND_COMMENT' : 'COMMENT';
                    result.content = comment;
                    this.logger.debug('[POP] 댓글 작성', { comment });
                }
            }
        }

        return result;
    }

    /**
     * 댓글 생성
     */
    _generateComment(salvation) {
        const emotionalContext = salvation?.emotional_context || 'curiosity';
        
        const commentsByContext = {
            nostalgia: [
                '이 영상을 보니 예전 생각이 나네요.',
                '좋은 추억을 떠올리게 해주는 영상이에요.',
                '시간이 참 빨리 지나갔네요.'
            ],
            curiosity: [
                '흥미로운 내용이네요!',
                '더 알고 싶어지는 주제예요.',
                '새로운 시각을 얻었습니다.'
            ],
            solidarity: [
                '공감되는 내용입니다.',
                '함께 생각해볼 문제네요.',
                '많은 분들이 봤으면 좋겠어요.'
            ]
        };

        const comments = commentsByContext[emotionalContext] || commentsByContext.curiosity;
        return comments[Math.floor(Math.random() * comments.length)];
    }

    /**
     * 자연스러운 스크롤
     */
    _naturalScroll() {
        try {
            const direction = Math.random() < 0.5 ? 'down' : 'up';
            const distance = 50 + Math.floor(Math.random() * 100);
            
            if (direction === 'down') {
                swipe(540, 1500, 540, 1500 - distance, 300);
            } else {
                swipe(540, 1000, 540, 1000 + distance, 300);
            }
        } catch (e) {
            // 스크롤 실패는 무시
        }
    }

    /**
     * 복귀 행동 실행
     */
    _executeReturnBehavior(behavior) {
        switch (behavior) {
            case ReturnBehavior.IDLE:
                this._goHome();
                break;
            case ReturnBehavior.NEXT_QUEUE:
                // Router에서 자동 처리됨
                break;
            case ReturnBehavior.REPORT_REACTION:
            default:
                // 다음 명령 대기
                break;
        }
    }

    /**
     * 홈으로 이동
     */
    _goHome() {
        try {
            home();
            sleep(1000);
        } catch (e) {
            // 무시
        }
    }
}

module.exports = PopHandler;
module.exports.PopAction = PopAction;
module.exports.ReturnBehavior = ReturnBehavior;

