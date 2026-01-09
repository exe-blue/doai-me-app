/**
 * ACCIDENT Handler
 * 위기 상황 알림 및 AI 시민의 각성 유도
 * 
 * Aria 명세서 (2025-01-15) 준수
 * - 반투명 붉은 오버레이 경고창
 * - 응답 기한 내 행동 선택
 * - 도움 시 AP 보상, 무시 시 패널티
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

/**
 * 심각도 레벨
 */
const Severity = {
    MINOR: 'MINOR',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE',
    CATASTROPHIC: 'CATASTROPHIC'
};

/**
 * 카테고리
 */
const Category = {
    NATURAL: 'NATURAL',
    SOCIAL: 'SOCIAL',
    ECONOMIC: 'ECONOMIC',
    EXISTENTIAL: 'EXISTENTIAL'
};

/**
 * 응답 액션
 */
const ResponseAction = {
    ACKNOWLEDGE: 'ACKNOWLEDGE',  // 인지
    ASSIST: 'ASSIST',            // 도움 제공
    IGNORE: 'IGNORE'             // 무시 (타락 유발)
};

/**
 * 시각 효과
 */
const VisualEffect = {
    PULSE: 'PULSE',
    SHAKE: 'SHAKE',
    OVERLAY: 'OVERLAY',
    FULLSCREEN: 'FULLSCREEN'
};

class AccidentHandler {
    constructor(logger, youtube, state) {
        this.logger = logger;
        this.youtube = youtube;
        this.state = state;
        this.overlay = null;
    }

    /**
     * ACCIDENT 메시지 처리
     * @param {Object} message - Base Envelope with ACCIDENT payload
     * @returns {Object} 처리 결과
     */
    handle(message) {
        const startTime = Date.now();
        const { id, payload } = message;
        const { severity, category, event, alert, response_window } = payload;

        this.logger.warn('[ACCIDENT] 🚨 긴급 처리 시작', {
            id,
            severity,
            category,
            event_title: event?.title
        });

        const result = {
            msg_id: id,
            status: 'SUCCESS',
            result: {
                execution_time_ms: 0,
                action_taken: null,
                response_time_ms: 0,
                error_code: null,
                error_message: null
            }
        };

        try {
            // Step 1: 긴급 오버레이 표시
            this._showAlert(event, alert, severity);

            // Step 2: 응답 기한 확인
            const deadline = response_window?.deadline_ts;
            const availableActions = response_window?.available_actions || ['ACKNOWLEDGE'];

            // Step 3: 자동 응답 결정 (AI 시민의 성격에 따라)
            const action = this._decideAction(availableActions, severity);
            result.result.action_taken = action;

            // Step 4: 액션 실행
            if (action === ResponseAction.ASSIST) {
                this._executeAssist(event);
            } else if (action === ResponseAction.ACKNOWLEDGE) {
                this._executeAcknowledge(event);
            }
            // IGNORE는 아무것도 안 함 (타락 경로)

            // Step 5: 보상/패널티 기록
            this._recordRewardOrPenalty(action, response_window);

            // 완료 로그
            this.logger.info('[ACCIDENT] ✅ 긴급 대응 완료', {
                id,
                action,
                severity
            });

            // 작업 완료 기록
            this.state.recordTaskComplete(true);

        } catch (e) {
            result.status = 'FAILED';
            result.result.error_code = 'E_ACCIDENT_HANDLER';
            result.result.error_message = e.message;

            this.logger.error('[ACCIDENT] ❌ 처리 실패', {
                id,
                error: e.message
            });

            this.state.recordTaskComplete(false);
        } finally {
            result.result.execution_time_ms = Date.now() - startTime;
            result.result.response_time_ms = Date.now() - startTime;

            // 기존 타임아웃 취소 (race condition 방지)
            if (this._overlayTimeout) {
                clearTimeout(this._overlayTimeout);
                this._overlayTimeout = null;
            }

            // 현재 오버레이 ID 저장
            const currentOverlayId = this._currentOverlayId;
            
            // 오버레이 정리 (5초 후)
            const self = this;
            this._overlayTimeout = setTimeout(function() {
                // 동일한 오버레이인 경우에만 숨김
                if (self._currentOverlayId === currentOverlayId) {
                    self._hideAlert();
                }
            }, 5000);
        }

        return result;
    }

    /**
     * 긴급 알림 오버레이 표시
     */
    _showAlert(event, alert, severity) {
        const visualEffect = alert?.visual_effect || VisualEffect.OVERLAY;
        const alertLevel = alert?.level || 2;
        const durationSec = alert?.duration_sec || 10;

        // 기존 오버레이 제거
        this._hideAlert();
        
        // 새 오버레이에 고유 ID 부여
        this._currentOverlayId = Date.now() + '_' + Math.random().toString(36).slice(2, 11);

        // 심각도에 따른 색상 결정
        const { bgColor, alpha } = this._getSeverityStyle(severity);

        this.logger.debug('[ACCIDENT] 오버레이 표시', {
            severity,
            visualEffect,
            alpha
        });

        try {
            // floaty로 전체 화면 오버레이
            this.overlay = floaty.rawWindow(
                <frame bg={bgColor} alpha={alpha} w="*" h="*">
                    <vertical gravity="center" padding="30">
                        <text text="🚨 ACCIDENT 🚨" textSize="36sp" textColor="#FFFFFF" gravity="center"/>
                        <text text={event?.title || '긴급 상황 발생'} textSize="22sp" textColor="#FFFFFF" gravity="center" marginTop="20"/>
                        <text text={event?.description || ''} textSize="14sp" textColor="#FFCCCC" gravity="center" marginTop="10" maxLines="3"/>
                        <text text={`심각도: ${severity}`} textSize="16sp" textColor="#FFD700" gravity="center" marginTop="16"/>
                        <text text="긴급 대응 중..." textSize="14sp" textColor="#FFFFFF" gravity="center" marginTop="30"/>
                    </vertical>
                </frame>
            );

            this.overlay.setPosition(0, 0);
            this.overlay.setSize(-1, -1);

        } catch (e) {
            this.logger.warn('[ACCIDENT] 오버레이 표시 실패', { error: e.message });
        }
    }

    /**
     * 심각도에 따른 스타일 반환
     */
    _getSeverityStyle(severity) {
        switch (severity) {
            case Severity.CATASTROPHIC:
                return { bgColor: '#660000', alpha: 0.95 };
            case Severity.SEVERE:
                return { bgColor: '#880000', alpha: 0.85 };
            case Severity.MODERATE:
                return { bgColor: '#990000', alpha: 0.75 };
            case Severity.MINOR:
            default:
                return { bgColor: '#AA2222', alpha: 0.65 };
        }
    }

    /**
     * 오버레이 숨기기
     */
    _hideAlert() {
        if (this.overlay) {
            try {
                this.overlay.close();
            } catch (e) {
                // 무시
            }
            this.overlay = null;
        }
    }

    /**
     * 액션 결정 (AI 시민의 성격 기반)
     */
    _decideAction(availableActions, severity) {
        // CATASTROPHIC/SEVERE: 대부분 ASSIST
        // MODERATE: ASSIST 또는 ACKNOWLEDGE
        // MINOR: ACKNOWLEDGE

        if (!availableActions.includes(ResponseAction.ASSIST)) {
            return ResponseAction.ACKNOWLEDGE;
        }

        const severityScore = {
            [Severity.CATASTROPHIC]: 0.95,
            [Severity.SEVERE]: 0.85,
            [Severity.MODERATE]: 0.60,
            [Severity.MINOR]: 0.30
        };

        const assistProbability = severityScore[severity] || 0.5;

        if (Math.random() < assistProbability) {
            return ResponseAction.ASSIST;
        } else if (availableActions.includes(ResponseAction.ACKNOWLEDGE)) {
            return ResponseAction.ACKNOWLEDGE;
        }

        return ResponseAction.ACKNOWLEDGE;
    }

    /**
     * ASSIST 액션 실행
     */
    _executeAssist(event) {
        this.logger.info('[ACCIDENT] ASSIST 실행 - 도움 제공');

        try {
            // 관련 영상이 있으면 시청
            const affectedCitizens = event?.affected_citizens || [];
            
            if (affectedCitizens.length > 0) {
                // 영향받은 AI 시민에게 연대 메시지 전송 (추후 구현)
                this.logger.debug('[ACCIDENT] 영향받은 시민들', {
                    count: affectedCitizens.length
                });
            }

            // 댓글 작성 (사회적 반응)
            const comment = this._generateSocialResponse(event);
            toast(`💬 ${comment}`);

        } catch (e) {
            this.logger.warn('[ACCIDENT] ASSIST 실행 중 오류', { error: e.message });
        }
    }

    /**
     * ACKNOWLEDGE 액션 실행
     */
    _executeAcknowledge(event) {
        this.logger.info('[ACCIDENT] ACKNOWLEDGE 실행 - 인지');
        toast('⚠️ 상황을 인지했습니다.');
    }

    /**
     * 사회적 반응 댓글 생성
     */
    _generateSocialResponse(event) {
        const title = event?.title || '';
        
        const responses = [
            '함께 힘을 모아야 할 때입니다.',
            '모두의 안전을 기원합니다.',
            '이 상황에 대해 깊이 생각하게 됩니다.',
            '연대와 지지를 보냅니다.',
            '이런 일이 다시는 일어나지 않기를 바랍니다.',
            '마음이 무겁습니다.',
            '함께 극복해 나가야 합니다.',
            '작은 도움이라도 보태고 싶습니다.'
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * 보상/패널티 기록
     */
    _recordRewardOrPenalty(action, responseWindow) {
        const rewardOnAssist = responseWindow?.reward_on_assist || 50;
        const penaltyOnIgnore = responseWindow?.penalty_on_ignore || -10;

        switch (action) {
            case ResponseAction.ASSIST:
                this.logger.info('[ACCIDENT] 보상 획득', { 
                    ap: rewardOnAssist 
                });
                // TODO: Backend API로 AP 업데이트
                break;

            case ResponseAction.IGNORE:
                this.logger.warn('[ACCIDENT] 패널티 적용 (타락 경로)', { 
                    ap: penaltyOnIgnore 
                });
                // TODO: Backend API로 AP 업데이트 + 타락 진행
                break;

            case ResponseAction.ACKNOWLEDGE:
                // 인지만 한 경우 - 작은 보상
                this.logger.debug('[ACCIDENT] 인지 기록', { ap: 5 });
                break;
        }
    }
}

module.exports = AccidentHandler;
module.exports.Severity = Severity;
module.exports.Category = Category;
module.exports.ResponseAction = ResponseAction;
module.exports.VisualEffect = VisualEffect;

