/**
 * DoAi-Client Receiver Module
 * Gateway로부터 ADB Broadcast 신호를 수신
 * 
 * Aria 명세서 (2025-01-15) 준수
 * 
 * Intent Action: org.anthropic.doaime.COMMAND
 * Extra Key: payload
 * Extra Value: JSON String (UTF-8 encoded)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

'nodejs';

// 프로토콜 상수 (Aria 명세서 기준)
const PROTOCOL = {
    VERSION: 1,
    INTENT_ACTION: 'org.anthropic.doaime.COMMAND',
    EXTRA_KEY: 'payload'
};

// 메시지 타입
const MessageType = {
    POP: 'POP',
    ACCIDENT: 'ACCIDENT',
    COMMISSION: 'COMMISSION',
    SYSTEM: 'SYSTEM'
};

// 우선순위 레벨 (1=lowest, 5=critical)
const Priority = {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    URGENT: 4,
    CRITICAL: 5
};

/**
 * Base Message Envelope 검증
 * @param {Object} message - 파싱된 메시지 객체
 * @returns {{valid: boolean, error: string|null}}
 */
function validateEnvelope(message) {
    // 필수 필드 체크
    const requiredFields = ['v', 'id', 'ts', 'type', 'priority', 'payload'];
    
    for (const field of requiredFields) {
        if (message[field] === undefined) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }
    
    // 버전 체크
    if (message.v !== PROTOCOL.VERSION) {
        return { valid: false, error: `Unsupported protocol version: ${message.v}` };
    }
    
    // 타입 체크
    if (!Object.values(MessageType).includes(message.type)) {
        return { valid: false, error: `Unknown message type: ${message.type}` };
    }
    
    // 우선순위 범위 체크
    if (message.priority < 1 || message.priority > 5) {
        return { valid: false, error: `Invalid priority: ${message.priority}` };
    }
    
    return { valid: true, error: null };
}

class Receiver {
    constructor(logger) {
        this.logger = logger;
        this.isListening = false;
        this.nativeReceiver = null;
        this.onMessageCallback = null;
        this.metrics = {
            received: 0,
            validated: 0,
            rejected: 0
        };
    }

    /**
     * 메시지 수신 콜백 등록
     * @param {Function} callback - (message: BaseEnvelope) => void
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * BroadcastReceiver 시작
     */
    startListening() {
        if (this.isListening) {
            this.logger.warn('[Receiver] 이미 청취 중');
            return;
        }

        this.logger.info('[Receiver] 청취 시작', { 
            action: PROTOCOL.INTENT_ACTION 
        });

        try {
            this._registerNativeReceiver();
            this.isListening = true;
            this.logger.info('[Receiver] ✅ 등록 완료');
        } catch (e) {
            this.logger.error('[Receiver] 등록 실패', { 
                error: e.message 
            });
            // 폴백 시도
            this._registerEventsReceiver();
        }
    }

    /**
     * Android Native BroadcastReceiver 등록
     */
    _registerNativeReceiver() {
        const self = this;
        
        this.nativeReceiver = new JavaAdapter(
            android.content.BroadcastReceiver, 
            {
                onReceive: function(ctx, intent) {
                    self._handleIntent(intent);
                }
            }
        );

        const filter = new android.content.IntentFilter(PROTOCOL.INTENT_ACTION);
        context.registerReceiver(this.nativeReceiver, filter);
        
        this.logger.info('[Receiver] Native BroadcastReceiver 등록됨');
    }

    /**
     * AutoX.js events.broadcast 폴백
     */
    _registerEventsReceiver() {
        this.logger.info('[Receiver] events.broadcast 폴백 사용');
        
        const self = this;
        // 리스너 참조 저장 (cleanup 위해)
        this._eventsListener = function(intent) {
            self._handleIntent(intent);
        };
        events.broadcast.on(PROTOCOL.INTENT_ACTION, this._eventsListener);

        this.isListening = true;
    }

    /**
     * 청취 중지
     */
    stopListening() {
        if (!this.isListening) return;

        try {
            // Native BroadcastReceiver 해제
            if (this.nativeReceiver) {
                context.unregisterReceiver(this.nativeReceiver);
                this.nativeReceiver = null;
            }
            
            // events.broadcast 리스너 해제 (메모리 누수 방지)
            if (this._eventsListener) {
                try {
                    events.broadcast.removeListener(PROTOCOL.INTENT_ACTION, this._eventsListener);
                } catch (evtErr) {
                    // removeListener가 없으면 off 시도
                    if (events.broadcast.off) {
                        events.broadcast.off(PROTOCOL.INTENT_ACTION, this._eventsListener);
                    }
                }
                this._eventsListener = null;
            }
            
            this.isListening = false;
            this.logger.info('[Receiver] 청취 중지됨');
        } catch (e) {
            this.logger.warn('[Receiver] 해제 중 오류', { error: e.message });
        }
    }

    /**
     * Intent 처리
     */
    _handleIntent(intent) {
        this.metrics.received++;
        
        try {
            // payload 추출
            const payloadStr = intent.getStringExtra(PROTOCOL.EXTRA_KEY);
            
            if (!payloadStr) {
                this.logger.warn('[Receiver] payload 없음');
                this.metrics.rejected++;
                return;
            }

            this.logger.debug('[Receiver] Raw payload', { 
                length: payloadStr.length 
            });

            // JSON 파싱 (안전한 처리)
            let message;
            try {
                // 먼저 원본 그대로 파싱 시도
                message = JSON.parse(payloadStr);
            } catch (firstParseError) {
                // 파싱 실패 시, 따옴표로 감싸진 이스케이프된 JSON인지 확인
                try {
                    if (payloadStr.startsWith('"') && payloadStr.endsWith('"')) {
                        // 외부 따옴표 제거 후 내부 문자열을 JSON으로 파싱
                        const innerStr = JSON.parse(payloadStr);
                        message = JSON.parse(innerStr);
                    } else {
                        throw firstParseError;
                    }
                } catch (secondParseError) {
                    this.logger.error('[Receiver] JSON 파싱 실패', {
                        error: secondParseError.message,
                        raw: payloadStr.substring(0, 100)
                    });
                    this.metrics.rejected++;
                    return;
                }
            }

            // Envelope 검증
            const validation = validateEnvelope(message);
            if (!validation.valid) {
                this.logger.warn('[Receiver] 검증 실패', {
                    error: validation.error,
                    msg_id: message.id
                });
                this.metrics.rejected++;
                return;
            }

            this.metrics.validated++;

            this.logger.info('[Receiver] 📥 메시지 수신', {
                id: message.id,
                type: message.type,
                priority: message.priority,
                ack_required: message.ack_required
            });

            // 콜백 호출 (Router로 전달)
            if (this.onMessageCallback) {
                this.onMessageCallback(message);
            }

        } catch (e) {
            this.logger.error('[Receiver] Intent 처리 오류', {
                error: e.message,
                stack: e.stack
            });
            this.metrics.rejected++;
        }
    }

    /**
     * 메트릭 반환
     */
    getMetrics() {
        return { ...this.metrics };
    }
}

module.exports = Receiver;
module.exports.PROTOCOL = PROTOCOL;
module.exports.MessageType = MessageType;
module.exports.Priority = Priority;
module.exports.validateEnvelope = validateEnvelope;

