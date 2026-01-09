/**
 * YouTube Pipeline WebSocket Protocol
 * 
 * Aria's YouTube MCP Pipeline Specification v1.0
 * 
 * 4가지 Activity 모듈의 WebSocket 메시지 정의
 * - MINING (🎭 Persona Activity)
 * - SURFING (🍿 POP Activity)
 * - RESPONSE (🔥 Accident Activity)
 * - LABOR (💰 Economy Activity)
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

// ============================================================================
// 메시지 타입 정의
// ============================================================================

const YOUTUBE_MESSAGE_TYPES = {
    // ========== MINING (🎭 Persona Activity) ==========
    // Gateway → Device
    MINING_WATCH: 'mining:watch',
    // Device → Gateway
    MINING_PROGRESS: 'mining:progress',
    MINING_COMPLETE: 'mining:complete',
    MINING_ERROR: 'mining:error',

    // ========== SURFING (🍿 POP Activity) ==========
    // Gateway → Device
    POP_WATCH: 'pop:watch',
    // Device → Gateway
    POP_PROGRESS: 'pop:progress',
    POP_COMPLETE: 'pop:complete',
    POP_ERROR: 'pop:error',

    // ========== RESPONSE (🔥 Accident Activity) ==========
    // Gateway → Device (HIGHEST PRIORITY)
    ACCIDENT_INTERRUPT: 'accident:interrupt',
    // Device → Gateway
    ACCIDENT_ACKNOWLEDGE: 'accident:acknowledge',
    ACCIDENT_RESPONSE: 'accident:response',
    ACCIDENT_COMPLETE: 'accident:complete',
    ACCIDENT_ERROR: 'accident:error',

    // ========== LABOR (💰 Economy Activity) ==========
    // Gateway → Device
    LABOR_WATCH: 'labor:watch',
    // Device → Gateway
    LABOR_PROGRESS: 'labor:progress',
    LABOR_PROOF: 'labor:proof',
    LABOR_COMPLETE: 'labor:complete',
    LABOR_ERROR: 'labor:error',

    // ========== Common ==========
    ACTIVITY_STATUS: 'activity:status',
    ACTIVITY_CANCEL: 'activity:cancel'
};

// ============================================================================
// 우선순위 정의
// ============================================================================

const ACTIVITY_PRIORITY = {
    CATASTROPHIC: 0,    // 🔥 ACCIDENT - 즉시 인터럽트
    ACCIDENT: 1,        // 🔥 ACCIDENT - 안전 지점 후 인터럽트
    URGENT_POP: 2,      // 🍿 긴급 POP
    NORMAL_POP: 3,      // 🍿 일반 POP / 💰 LABOR
    LABOR: 3,           // 💰 LABOR
    MINING: 4           // 🎭 MINING (자기 주도)
};

// ============================================================================
// 메시지 스키마 정의
// ============================================================================

/**
 * MINING_WATCH - 시청 명령
 * Gateway → Device
 */
const MiningWatchSchema = {
    type: YOUTUBE_MESSAGE_TYPES.MINING_WATCH,
    payload: {
        citizen_id: 'string',           // UUID
        video_id: 'string',             // 11자
        video_url: 'string',            // https://youtube.com/watch?v=xxx
        expected_duration: 'number',     // 초
        instructions: {
            min_watch_percentage: 'number', // 0.0 ~ 1.0
            take_screenshots: 'boolean',
            screenshot_intervals: 'number[]', // [30, 60, 120, ...]
            generate_comment: 'boolean'
        }
    },
    timestamp: 'string'
};

/**
 * MINING_PROGRESS - 진행 상황
 * Device → Gateway
 */
const MiningProgressSchema = {
    type: YOUTUBE_MESSAGE_TYPES.MINING_PROGRESS,
    payload: {
        citizen_id: 'string',
        video_id: 'string',
        current_time: 'number',         // 현재 재생 위치 (초)
        percentage: 'number',           // 0.0 ~ 1.0
        screenshots_taken: 'number'
    },
    timestamp: 'string'
};

/**
 * MINING_COMPLETE - 시청 완료
 * Device → Gateway
 */
const MiningCompleteSchema = {
    type: YOUTUBE_MESSAGE_TYPES.MINING_COMPLETE,
    payload: {
        citizen_id: 'string',
        video_id: 'string',
        watch_duration: 'number',
        final_percentage: 'number',
        screenshots: 'string[]',        // base64 또는 경로
        detected_moments: [{
            timestamp: 'number',
            description: 'string'
        }],
        emotional_response: {
            joy: 'number',
            sadness: 'number',
            surprise: 'number',
            anger: 'number',
            fear: 'number',
            trust: 'number'
        }
    },
    timestamp: 'string'
};

/**
 * POP_WATCH - POP 시청 명령
 * Gateway → Device
 */
const PopWatchSchema = {
    type: YOUTUBE_MESSAGE_TYPES.POP_WATCH,
    payload: {
        broadcast_id: 'string',         // UUID
        video_id: 'string',
        video_url: 'string',
        trending_rank: 'number',
        comment_sentiment: 'string',    // 'positive' | 'neutral' | 'negative' | 'mixed'
        common_phrases: 'string[]',     // ['ㅋㅋㅋ', '대박', ...]
        instructions: {
            min_watch_percentage: 'number',
            generate_conforming_comment: 'boolean'
        }
    },
    timestamp: 'string'
};

/**
 * ACCIDENT_INTERRUPT - 긴급 인터럽트
 * Gateway → ALL Devices (Broadcast)
 */
const AccidentInterruptSchema = {
    type: YOUTUBE_MESSAGE_TYPES.ACCIDENT_INTERRUPT,
    priority: 'number',                 // 0 = immediate, 1 = after safe point
    payload: {
        accident_id: 'string',          // UUID
        video_id: 'string',
        video_url: 'string',
        headline: 'string',
        severity: 'string',             // 'MINOR' | 'MODERATE' | 'SEVERE' | 'CATASTROPHIC'
        response_action: 'string',      // 'WATCH_CRITICAL' | 'REPORT' | 'COUNTER_COMMENT'
        instructions: {
            save_current_state: 'boolean',
            max_response_time: 'number',     // 초
            critical_comment_required: 'boolean'
        }
    },
    timestamp: 'string'
};

/**
 * LABOR_WATCH - 노동 시청 명령
 * Gateway → Device
 */
const LaborWatchSchema = {
    type: YOUTUBE_MESSAGE_TYPES.LABOR_WATCH,
    payload: {
        assignment_id: 'string',        // UUID
        commission_id: 'string',        // UUID
        video_id: 'string',
        video_url: 'string',
        video_duration: 'number',
        instructions: {
            min_watch_percentage: 'number',
            screenshot_timestamps: 'number[]', // 스크린샷 찍을 시점
            log_interval: 'number'             // 진행 로그 간격 (초)
        }
    },
    timestamp: 'string'
};

/**
 * LABOR_PROOF - 시청 증명
 * Device → Gateway
 */
const LaborProofSchema = {
    type: YOUTUBE_MESSAGE_TYPES.LABOR_PROOF,
    payload: {
        assignment_id: 'string',
        commission_id: 'string',
        video_id: 'string',
        citizen_id: 'string',
        
        // Event logs
        start_event: {
            timestamp: 'string',        // ISO 8601
            video_position: 'number',   // 0
            device_time: 'string'
        },
        end_event: {
            timestamp: 'string',
            video_position: 'number',
            device_time: 'string'
        },
        
        // Duration
        video_duration: 'number',
        watch_duration: 'number',
        
        // Screenshots
        screenshots: [{
            timestamp: 'number',        // 영상 내 위치
            image_base64: 'string',
            captured_at: 'string'
        }],
        
        // Timeline
        timeline_events: [{
            type: 'string',             // 'PLAY' | 'PAUSE' | 'SEEK' | 'BUFFER'
            timestamp: 'number',
            device_time: 'string'
        }],
        
        final_timestamp: 'number'
    },
    timestamp: 'string'
};

// ============================================================================
// 메시지 팩토리 함수
// ============================================================================

/**
 * MINING_WATCH 메시지 생성
 */
function createMiningWatch(citizenId, videoId, options = {}) {
    return {
        type: YOUTUBE_MESSAGE_TYPES.MINING_WATCH,
        payload: {
            citizen_id: citizenId,
            video_id: videoId,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            expected_duration: options.duration || 0,
            instructions: {
                min_watch_percentage: options.minWatchPercentage || 0.7,
                take_screenshots: options.takeScreenshots !== false,
                screenshot_intervals: options.screenshotIntervals || [30, 60, 120, 180, 240],
                generate_comment: options.generateComment !== false
            }
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * POP_WATCH 메시지 생성
 */
function createPopWatch(broadcastId, videoId, options = {}) {
    return {
        type: YOUTUBE_MESSAGE_TYPES.POP_WATCH,
        payload: {
            broadcast_id: broadcastId,
            video_id: videoId,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            trending_rank: options.trendingRank || 0,
            comment_sentiment: options.commentSentiment || 'neutral',
            common_phrases: options.commonPhrases || [],
            instructions: {
                min_watch_percentage: options.minWatchPercentage || 0.6,
                generate_conforming_comment: options.generateConformComment !== false
            }
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * ACCIDENT_INTERRUPT 메시지 생성
 */
function createAccidentInterrupt(accidentId, videoId, severity, options = {}) {
    const priorityMap = {
        'CATASTROPHIC': 0,
        'SEVERE': 1,
        'MODERATE': 1,
        'MINOR': 1
    };

    return {
        type: YOUTUBE_MESSAGE_TYPES.ACCIDENT_INTERRUPT,
        priority: priorityMap[severity] ?? 1,
        payload: {
            accident_id: accidentId,
            video_id: videoId,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            headline: options.headline || '',
            severity: severity,
            response_action: options.responseAction || 'WATCH_CRITICAL',
            instructions: {
                save_current_state: true,
                max_response_time: priorityMap[severity] === 0 ? 300 : 600,
                critical_comment_required: options.responseAction === 'COUNTER_COMMENT'
            }
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * LABOR_WATCH 메시지 생성
 */
function createLaborWatch(assignmentId, commissionId, videoId, options = {}) {
    return {
        type: YOUTUBE_MESSAGE_TYPES.LABOR_WATCH,
        payload: {
            assignment_id: assignmentId,
            commission_id: commissionId,
            video_id: videoId,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            video_duration: options.videoDuration || 0,
            instructions: {
                min_watch_percentage: options.minWatchPercentage || 0.9,
                screenshot_timestamps: options.screenshotTimestamps || [],
                log_interval: options.logInterval || 30
            }
        },
        timestamp: new Date().toISOString()
    };
}

// ============================================================================
// 메시지 검증 함수
// ============================================================================

/**
 * 메시지 타입이 YouTube Pipeline 메시지인지 확인
 */
function isYouTubeMessage(type) {
    return Object.values(YOUTUBE_MESSAGE_TYPES).includes(type);
}

/**
 * 메시지 우선순위 반환
 */
function getMessagePriority(message) {
    switch (message.type) {
        case YOUTUBE_MESSAGE_TYPES.ACCIDENT_INTERRUPT:
            return message.priority ?? ACTIVITY_PRIORITY.ACCIDENT;
        case YOUTUBE_MESSAGE_TYPES.POP_WATCH:
            return ACTIVITY_PRIORITY.NORMAL_POP;
        case YOUTUBE_MESSAGE_TYPES.LABOR_WATCH:
            return ACTIVITY_PRIORITY.LABOR;
        case YOUTUBE_MESSAGE_TYPES.MINING_WATCH:
            return ACTIVITY_PRIORITY.MINING;
        default:
            return 5; // 최저 우선순위
    }
}

/**
 * 인터럽트 가능 여부 확인
 * @param {string} currentActivity - 현재 활동 타입
 * @param {Object} newMessage - 새로운 메시지
 * @returns {boolean} 인터럽트 가능 여부
 */
function canInterrupt(currentActivity, newMessage) {
    const currentPriority = ACTIVITY_PRIORITY[currentActivity] ?? 5;
    const newPriority = getMessagePriority(newMessage);
    
    // 새 메시지의 우선순위가 더 높으면(숫자가 낮으면) 인터럽트 가능
    return newPriority < currentPriority;
}

// ============================================================================
// 내보내기
// ============================================================================

module.exports = {
    YOUTUBE_MESSAGE_TYPES,
    ACTIVITY_PRIORITY,
    
    // 메시지 팩토리
    createMiningWatch,
    createPopWatch,
    createAccidentInterrupt,
    createLaborWatch,
    
    // 유틸리티
    isYouTubeMessage,
    getMessagePriority,
    canInterrupt,
    
    // 스키마 (문서화/검증용)
    schemas: {
        MiningWatchSchema,
        MiningProgressSchema,
        MiningCompleteSchema,
        PopWatchSchema,
        AccidentInterruptSchema,
        LaborWatchSchema,
        LaborProofSchema
    }
};

