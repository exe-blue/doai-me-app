/**
 * DoAi.Me Receiver Module
 * Gateway(PC)로부터 ADB Broadcast 신호를 수신하여 처리
 * 
 * Physical Link Layer - Orion 지시 (2024-12-30)
 * 
 * Intent Action: com.doai.me.COMMAND
 * 
 * Gateway 송신 예시:
 * am broadcast -a com.doai.me.COMMAND --es type "POP" --es payload '{"url":"..."}'
 * 
 * 핸들러:
 * - POP: YouTube 영상 시청 (youtube.js 활용)
 * - ACCIDENT: 반투명 붉은 오버레이 경고창 + 긴급 반응
 * - COMMISSION: 로그 출력 후 tasks.js로 전달 (추후 구현)
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0 (Physical Link Layer)
 */

'nodejs';

const INTENT_ACTION = 'com.doai.me.COMMAND';

// 명령 타입 상수 (Gateway와 동일)
const CommandType = {
    POP: 'POP',             // Pop 영상 시청 (공통 채널 신작)
    ACCIDENT: 'ACCIDENT',   // Accident 긴급 반응
    COMMISSION: 'COMMISSION', // 의뢰 할당
    TASK: 'TASK',           // 일반 작업
    CALL: 'CALL',           // 페르소나 호출 (존재 확인)
    STOP: 'STOP'            // 중지 명령
};

class Receiver {
    constructor(config, logger, youtube) {
        this.config = config;
        this.logger = logger;
        this.youtube = youtube;
        this.isListening = false;
        this.receiver = null;
        this.onCommandCallback = null;
        
        // 긴급 오버레이 창 참조
        this.emergencyOverlay = null;
    }

    /**
     * 명령 수신 콜백 등록
     * @param {Function} callback - (type, payload) => void
     */
    onCommand(callback) {
        this.onCommandCallback = callback;
    }

    /**
     * BroadcastReceiver 등록 및 청취 시작
     * events.broadcast 사용 (AutoX.js 네이티브)
     */
    startListening() {
        if (this.isListening) {
            this.logger.warn('Receiver가 이미 청취 중입니다');
            return;
        }

        this.logger.info('🎧 Receiver 청취 시작', { action: INTENT_ACTION });

        try {
            // 방법 1: AutoX.js BroadcastReceiver (Android Native)
            this._registerNativeReceiver();

            this.isListening = true;
            this.logger.info('✅ Receiver 등록 완료 (Physical Link Layer Ready)');

        } catch (e) {
            this.logger.error('Receiver 등록 실패', { 
                error: e.message,
                stack: e.stack 
            });
            
            // 폴백: events.broadcast 사용
            this._registerEventsReceiver();
        }
    }

    /**
     * Android Native BroadcastReceiver 등록
     */
    _registerNativeReceiver() {
        // AutoX.js JavaAdapter로 BroadcastReceiver 생성
        this.receiver = new JavaAdapter(android.content.BroadcastReceiver, {
            onReceive: (ctx, intent) => {
                this._handleIntent(intent);
            }
        });

        // IntentFilter 생성 및 등록
        const filter = new android.content.IntentFilter(INTENT_ACTION);
        context.registerReceiver(this.receiver, filter);
        
        this.logger.info('Native BroadcastReceiver 등록됨');
    }

    /**
     * AutoX.js events.broadcast 사용 (폴백)
     */
    _registerEventsReceiver() {
        this.logger.info('events.broadcast 사용 (폴백)');
        
        // AutoX.js의 events.broadcast로 수신
        events.broadcast.on(INTENT_ACTION, (intent) => {
            this._handleIntent(intent);
        });

        this.isListening = true;
    }

    /**
     * 청취 중지 및 리시버 해제
     */
    stopListening() {
        if (!this.isListening) {
            return;
        }

        try {
            if (this.receiver) {
                context.unregisterReceiver(this.receiver);
                this.receiver = null;
            }
            this.isListening = false;
            this.logger.info('Receiver 청취 중지됨');
        } catch (e) {
            this.logger.warn('Receiver 해제 중 오류', { error: e.message });
        }

        // 오버레이 정리
        this._hideEmergencyOverlay();
    }

    /**
     * Intent 처리 (내부)
     */
    _handleIntent(intent) {
        try {
            // Intent에서 extras 추출
            const type = intent.getStringExtra('type');
            const payloadStr = intent.getStringExtra('payload');

            this.logger.info('📥 [RECEIVED] 명령 수신', { 
                type, 
                payloadRaw: payloadStr 
            });

            // Payload 파싱
            let payload = {};
            if (payloadStr) {
                try {
                    // Gateway에서 이스케이프된 JSON 처리
                    const cleanPayload = payloadStr.replace(/\\"/g, '"');
                    payload = JSON.parse(cleanPayload);
                } catch (parseError) {
                    // 이미 객체인 경우
                    this.logger.warn('Payload JSON 파싱 실패, raw 사용', { 
                        raw: payloadStr,
                        error: parseError.message 
                    });
                    payload = { raw: payloadStr };
                }
            }

            // 명령 타입별 처리
            this._processCommand(type, payload);

            // 콜백 호출 (main.js에서 추가 처리)
            if (this.onCommandCallback) {
                this.onCommandCallback(type, payload);
            }

        } catch (e) {
            this.logger.error('Intent 처리 중 오류', { 
                error: e.message,
                stack: e.stack 
            });
        }
    }

    /**
     * 명령 타입별 처리 (Orion 핸들러 로직)
     */
    _processCommand(type, payload) {
        switch (type) {
            case CommandType.POP:
                this._handlePop(payload);
                break;

            case CommandType.ACCIDENT:
                this._handleAccident(payload);
                break;

            case CommandType.COMMISSION:
                this._handleCommission(payload);
                break;

            case CommandType.TASK:
                this._handleTask(payload);
                break;

            case CommandType.CALL:
                this._handleCall(payload);
                break;

            case CommandType.STOP:
                this._handleStop(payload);
                break;

            default:
                this.logger.warn('알 수 없는 명령 타입', { type, payload });
        }
    }

    // ============================================
    // POP 처리 - 공통 채널 신작 영상 시청
    // ============================================
    /**
     * Orion 지시: payload.url을 파싱하여 유튜브 실행 (기존 youtube.js 활용)
     */
    _handlePop(payload) {
        this.logger.info('🎬 [POP] 처리 시작', payload);

        const { url, title, channel } = payload;

        if (!url) {
            this.logger.error('[POP] URL이 없습니다');
            return;
        }

        // 스레드에서 YouTube 시청 실행 (비동기)
        const self = this;
        threads.start(function() {
            try {
                // YouTube 앱 실행
                if (!self.youtube.launchYouTube()) {
                    self.logger.error('[POP] YouTube 앱 실행 실패');
                    return;
                }

                sleep(2000);

                // URL로 영상 열기
                self.logger.info('[POP] 영상으로 이동', { url, title });
                
                if (self.youtube.openByUrl) {
                    self.youtube.openByUrl(url);
                } else {
                    // URL 직접 열기 (폴백)
                    app.openUrl(url);
                }

                sleep(3000);

                // 시청 (최소 30초, 최대 3분)
                const watchTime = 30 + Math.floor(Math.random() * 150);
                self.logger.info('[POP] 시청 중...', { watchTime });
                sleep(watchTime * 1000);

                // 좋아요 (70% 확률)
                if (Math.random() < 0.7 && self.youtube.clickLike) {
                    self.youtube.clickLike();
                    self.logger.info('[POP] 좋아요 클릭');
                }

                // 댓글 (30% 확률)
                if (Math.random() < 0.3 && self.youtube.writeComment) {
                    self.youtube.writeComment();
                }

                self.logger.info('[POP] 시청 완료', { 
                    url, 
                    watchTime,
                    title: title || '(제목 없음)'
                });

            } catch (e) {
                self.logger.error('[POP] 처리 중 오류', { error: e.message });
            }
        });
    }

    // ============================================
    // ACCIDENT 처리 - 긴급 사회적 반응
    // ============================================
    /**
     * Orion 지시: floaty를 사용하여 화면 전체에 반투명 붉은 오버레이 경고창 출력
     */
    _handleAccident(payload) {
        this.logger.warn('🚨 [ACCIDENT] 긴급 처리 시작', payload);

        const { url, title, severity, response_template } = payload;

        if (!url) {
            this.logger.error('[ACCIDENT] URL이 없습니다');
            return;
        }

        // UI 스레드에서 긴급 오버레이 표시 (Orion 지시: 반투명 붉은 오버레이)
        const self = this;
        ui.run(function() {
            self._showEmergencyOverlay(title, severity || 5);
        });

        // 별도 스레드에서 영상 처리
        threads.start(function() {
            try {
                // 현재 작업 중단
                self.logger.warn('[ACCIDENT] 현재 작업 중단, 긴급 대응');

                // YouTube 앱 실행
                if (!self.youtube.launchYouTube()) {
                    self.logger.error('[ACCIDENT] YouTube 앱 실행 실패');
                    return;
                }

                sleep(2000);

                // 영상으로 이동
                if (self.youtube.openByUrl) {
                    self.youtube.openByUrl(url);
                } else {
                    app.openUrl(url);
                }
                
                sleep(3000);

                // 긴급 반응 - severity에 따른 시청 시간 (최소 30초, 최대 90초)
                const watchTime = Math.max(30, Math.min(90, (severity || 5) * 10));
                self.logger.info('[ACCIDENT] 긴급 시청', { watchTime, severity });
                sleep(watchTime * 1000);

                // 사회적 반응 댓글 작성
                const accidentComment = self._generateAccidentComment(title, response_template);
                if (self.youtube.writeCustomComment) {
                    self.youtube.writeCustomComment(accidentComment);
                    self.logger.info('[ACCIDENT] 댓글 작성', { comment: accidentComment });
                }

                // 좋아요
                if (self.youtube.clickLike) {
                    self.youtube.clickLike();
                }

                self.logger.info('[ACCIDENT] 긴급 반응 완료', { url });

                // 5초 후 오버레이 닫기
                sleep(5000);
                ui.run(function() {
                    self._hideEmergencyOverlay();
                });

            } catch (e) {
                self.logger.error('[ACCIDENT] 처리 중 오류', { error: e.message });
                ui.run(function() {
                    self._hideEmergencyOverlay();
                });
            }
        });
    }

    // ============================================
    // COMMISSION 처리 - 의뢰 할당
    // ============================================
    /**
     * Orion 지시: payload 내용을 로그로 찍고 tasks.js(추후 구현)로 전달
     */
    _handleCommission(payload) {
        this.logger.info('📋 [COMMISSION] 의뢰 수신', payload);

        const { 
            commission_id, 
            title, 
            reward, 
            deadline,
            requirements 
        } = payload;

        // 로그 출력 (Orion 지시)
        this.logger.info('[COMMISSION] 상세 정보', {
            commission_id,
            title,
            reward,
            deadline,
            requirements
        });

        // TODO: tasks.js로 전달 (추후 구현)
        // tasks.queue(payload);

        // 토스트로 알림
        toast(`📋 새 의뢰: ${title || commission_id}`);

        // 콜백으로 전달 (main.js에서 DecisionEngine으로 처리)
        // onCommandCallback에서 처리됨
    }

    // ============================================
    // TASK 처리 - 일반 작업 할당
    // ============================================
    _handleTask(payload) {
        this.logger.info('📋 [TASK] 작업 수신', payload);
        // main.js 콜백에서 처리
    }

    // ============================================
    // CALL 처리 - 페르소나 호출
    // ============================================
    _handleCall(payload) {
        this.logger.info('📞 [CALL] 호출 수신 - 나는 존재한다', payload);

        const { persona_id, message } = payload;
        const deviceId = this.config.device?.id || 'Unknown';

        // 존재 응답
        this.logger.info(`✨ ${deviceId}: 네, 여기 있습니다.`);

        // 화면에 토스트 표시
        toast(`🤖 ${message || '호출됨!'}`);
    }

    // ============================================
    // STOP 처리 - 중지 명령
    // ============================================
    _handleStop(payload) {
        this.logger.warn('🛑 [STOP] 중지 명령 수신', payload);

        const { reason } = payload;
        this.logger.info('[STOP] 이유', { reason: reason || '없음' });

        // 이벤트 발생으로 메인 루프에 알림
        events.broadcast.emit('stop_requested', { reason });
    }

    // ============================================
    // UI 헬퍼 함수
    // ============================================

    /**
     * 긴급 오버레이 표시 (Orion 지시: 반투명 붉은 오버레이)
     */
    _showEmergencyOverlay(title, severity) {
        try {
            // 기존 오버레이 제거
            this._hideEmergencyOverlay();

            // severity에 따른 색상 (높을수록 진한 빨강)
            const alpha = Math.min(0.9, 0.5 + (severity / 10) * 0.4);
            const severityColor = severity >= 8 ? '#FF0000' : 
                                  severity >= 5 ? '#FF4444' : '#FF8888';

            // floaty로 전체 화면 오버레이 (Orion 지시)
            this.emergencyOverlay = floaty.rawWindow(
                <frame bg="#990000" alpha={alpha} w="*" h="*">
                    <vertical gravity="center" padding="20">
                        <text text="🚨 ACCIDENT 🚨" textSize="32sp" textColor="#FFFFFF" gravity="center"/>
                        <text text={title || '긴급 상황 발생'} textSize="20sp" textColor="#FFFFFF" gravity="center" marginTop="16"/>
                        <text text={`심각도: ${severity || 5}/10`} textSize="16sp" textColor={severityColor} gravity="center" marginTop="8"/>
                        <text text="긴급 대응 중..." textSize="14sp" textColor="#FFCCCC" gravity="center" marginTop="24"/>
                    </vertical>
                </frame>
            );

            // 전체 화면 설정
            this.emergencyOverlay.setPosition(0, 0);
            this.emergencyOverlay.setSize(-1, -1);

            this.logger.info('[ACCIDENT] 오버레이 표시됨', { severity, alpha });

        } catch (e) {
            this.logger.warn('오버레이 표시 실패', { error: e.message });
        }
    }

    /**
     * 긴급 오버레이 숨기기
     */
    _hideEmergencyOverlay() {
        if (this.emergencyOverlay) {
            try {
                this.emergencyOverlay.close();
                this.logger.info('[ACCIDENT] 오버레이 닫힘');
            } catch (e) {
                // 무시
            }
            this.emergencyOverlay = null;
        }
    }

    /**
     * Accident 댓글 생성
     */
    _generateAccidentComment(title, template) {
        // 템플릿이 있으면 사용
        if (template) {
            return template;
        }

        // 기본 긴급 반응 댓글
        const templates = [
            '함께 힘을 모아야 할 때입니다.',
            '모두의 안전을 기원합니다.',
            '이 상황에 대해 깊이 생각하게 됩니다.',
            '연대와 지지를 보냅니다.',
            '이런 일이 다시는 일어나지 않기를 바랍니다.',
            '마음이 무겁습니다.',
            '함께 극복해 나가야 합니다.'
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }
}

module.exports = Receiver;
module.exports.CommandType = CommandType;
module.exports.INTENT_ACTION = INTENT_ACTION;
