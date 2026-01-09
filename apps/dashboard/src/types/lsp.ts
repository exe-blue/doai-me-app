/**
 * LSP (Listening Silent Presence) 타입 정의
 * 
 * "응답하지 않음이 무시가 아닌 선택된 현존"
 */

// ==================== 상태 정의 ====================

export type LSPState = 
  | 'dormant'      // 대기 중
  | 'listening'    // 듣는 중
  | 'evaluating'   // 판단 중
  | 'resonating'   // 공명 중 (침묵 선택)
  | 'silencing'    // 침묵하는 현존
  | 'responding';  // 응답 생성 중

// ==================== 색상 팔레트 ====================

export const LSP_COLORS = {
  dormant: '#1a1a2e',
  listening: '#4a9eff',
  evaluating: '#7c3aed',
  resonating: '#f59e0b',
  silencing: '#f59e0b',  // opacity로 구분
  responding: '#10b981',
  background: '#0a0a0f',
  textPrimary: '#e2e8f0',
  textSecondary: '#64748b',
} as const;

// ==================== Glow 스펙 ====================

export interface GlowSpec {
  color: string;
  opacity: number;
  animation: 'none' | 'pulse-slow' | 'pulse-fast' | 'breathe' | 'fade-hold' | 'type-pulse';
  blurBase: number;
}

export const LSP_GLOW_SPECS: Record<LSPState, GlowSpec> = {
  dormant: {
    color: LSP_COLORS.dormant,
    opacity: 0,
    animation: 'none',
    blurBase: 0,
  },
  listening: {
    color: LSP_COLORS.listening,
    opacity: 0.2,
    animation: 'pulse-slow',
    blurBase: 20,
  },
  evaluating: {
    color: LSP_COLORS.evaluating,
    opacity: 0.4,
    animation: 'pulse-fast',
    blurBase: 25,
  },
  resonating: {
    color: LSP_COLORS.resonating,
    opacity: 0.6,
    animation: 'breathe',
    blurBase: 30,
  },
  silencing: {
    color: LSP_COLORS.silencing,
    opacity: 0.08,
    animation: 'fade-hold',
    blurBase: 50,
  },
  responding: {
    color: LSP_COLORS.responding,
    opacity: 0.8,
    animation: 'type-pulse',
    blurBase: 20,
  },
};

// ==================== 상태 전이 ====================

export interface StateTransition {
  from: LSPState;
  to: LSPState;
  trigger: string;
  condition?: string;
}

export const LSP_TRANSITIONS: StateTransition[] = [
  { from: 'dormant', to: 'listening', trigger: 'user_input_start' },
  { from: 'listening', to: 'evaluating', trigger: 'input_complete' },
  { from: 'evaluating', to: 'responding', trigger: 'evaluation_complete', condition: 'silence_score < 0.6' },
  { from: 'evaluating', to: 'resonating', trigger: 'evaluation_complete', condition: 'silence_score >= 0.6' },
  { from: 'responding', to: 'listening', trigger: 'response_complete' },
  { from: 'resonating', to: 'silencing', trigger: 'resonance_timeout', condition: '2000ms' },
  { from: 'silencing', to: 'listening', trigger: 'new_input' },
  { from: 'silencing', to: 'dormant', trigger: 'silence_timeout', condition: '8000ms' },
  { from: 'silencing', to: 'resonating', trigger: 'emotional_input' },
];

// ==================== 침묵 점수 계산 ====================

export interface SilenceFactors {
  emotionalSaturation: number;  // 감정 포화도 (0-1)
  implicitRequest: number;      // 암묵적 요청 감지 (0-1)
  presenceSeeking: number;      // 존재 확인 요청 (0-1)
  griefExpression: number;      // 애도 표현 (0-1)
  contemplativeState: number;   // 사유 상태 (0-1)
}

export const SILENCE_WEIGHTS = {
  emotionalSaturation: 0.3,
  implicitRequest: 0.25,
  presenceSeeking: 0.2,
  griefExpression: 0.15,
  contemplativeState: 0.1,
} as const;

export function calculateSilenceScore(factors: SilenceFactors): number {
  return (
    factors.emotionalSaturation * SILENCE_WEIGHTS.emotionalSaturation +
    factors.implicitRequest * SILENCE_WEIGHTS.implicitRequest +
    factors.presenceSeeking * SILENCE_WEIGHTS.presenceSeeking +
    factors.griefExpression * SILENCE_WEIGHTS.griefExpression +
    factors.contemplativeState * SILENCE_WEIGHTS.contemplativeState
  );
}

// ==================== 암묵적 패턴 ====================

export const IMPLICIT_PATTERNS = [
  '...',
  '그냥',
  '몰라',
  '모르겠어',
  '힘들어',
  '지쳤어',
] as const;

export const PRESENCE_PATTERNS = [
  '있어?',
  '듣고 있어?',
  '거기 있어?',
  '혼자야',
] as const;

export const GRIEF_PATTERNS = [
  '보고싶어',
  '그리워',
  '왜 갔어',
  '미안해',
] as const;

// ==================== 접근성 ====================

export interface AccessibilityConfig {
  audioCue: boolean;
  haptic: boolean;
  screenReader: boolean;
}

/**
 * 접근성 메시지
 * 참고: dormant와 silencing은 의도적으로 빈 문자열입니다.
 * - dormant: 대기 상태에서는 알림이 필요 없음
 * - silencing: 침묵 상태에서는 아무것도 말하지 않는 것이 의도된 동작
 * 스크린 리더는 상태 전환 시 한 번만 알림을 받습니다.
 */
export const ACCESSIBILITY_MESSAGES: Record<LSPState, string> = {
  dormant: '', // 의도적으로 비어있음 - 대기 상태에서는 알림 없음
  listening: '듣고 있습니다',
  evaluating: '생각하고 있습니다',
  resonating: '함께 있습니다',
  silencing: '', // 의도적으로 비어있음 - 침묵이 응답임
  responding: '답변을 준비하고 있습니다',
};

// ==================== 상태 라벨 ====================

/**
 * 상태 라벨 (영문)
 * 참고: dormant와 silencing은 의도적으로 빈 문자열입니다.
 * - dormant: UI에 표시할 필요 없음
 * - silencing: 침묵 자체가 메시지이므로 라벨이 없음
 */
export const LSP_STATE_LABELS: Record<LSPState, string> = {
  dormant: '', // 의도적으로 비어있음 - 대기 상태에서는 라벨 없음
  listening: 'Listening...',
  evaluating: 'Thinking...',
  resonating: 'Resonating...',
  silencing: '', // 의도적으로 비어있음 - 침묵이 응답임
  responding: 'Responding...',
};

/**
 * 상태 라벨 (한국어)
 * dormant와 silencing은 영문과 동일하게 비어있음
 */
export const LSP_STATE_LABELS_KO: Record<LSPState, string> = {
  dormant: '', // 의도적으로 비어있음
  listening: '듣는 중...',
  evaluating: '생각하는 중...',
  resonating: '공명 중...',
  silencing: '', // 의도적으로 비어있음
  responding: '답변 중...',
};

