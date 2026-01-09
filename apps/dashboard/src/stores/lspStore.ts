/**
 * LSP (Listening Silent Presence) 상태 관리
 * 
 * 상태 머신 기반의 LSP 상태 관리
 */

import { create } from 'zustand';
import { 
  LSPState, 
  SilenceFactors, 
  calculateSilenceScore,
  IMPLICIT_PATTERNS,
  PRESENCE_PATTERNS,
  GRIEF_PATTERNS,
} from '../types/lsp';

// ==================== 타입 정의 ====================

interface LSPStore {
  // 현재 상태
  state: LSPState;
  silenceScore: number;
  factors: SilenceFactors;
  
  // 타이머
  resonanceTimer: NodeJS.Timeout | null;
  silenceTimer: NodeJS.Timeout | null;
  
  // 사용자 경험
  lspExperienceCount: number;
  showTooltip: boolean;
  
  // 입력 컨텍스트
  lastInputTime: number;
  silenceDuration: number;
  
  // 액션
  startListening: () => void;
  submitInput: (message: string) => void;
  completeResponse: () => void;
  presenceSignal: () => void;
  reset: () => void;
  
  // 내부 액션
  _transitionTo: (newState: LSPState) => void;
  _evaluateInput: (message: string) => void;
  _startResonanceTimer: () => void;
  _startSilenceTimer: () => void;
  _clearTimers: () => void;
}

// ==================== 패턴 감지 함수 ====================

function detectImplicitRequest(message: string): number {
  const lowerMessage = message.toLowerCase();
  const matches = IMPLICIT_PATTERNS.filter(p => lowerMessage.includes(p));
  return Math.min(matches.length * 0.3, 1);
}

function detectPresenceSeeking(message: string): number {
  const lowerMessage = message.toLowerCase();
  const matches = PRESENCE_PATTERNS.filter(p => lowerMessage.includes(p));
  return matches.length > 0 ? 0.8 : 0;
}

function detectGrief(message: string): number {
  const lowerMessage = message.toLowerCase();
  const matches = GRIEF_PATTERNS.filter(p => lowerMessage.includes(p));
  return Math.min(matches.length * 0.4, 1);
}

function analyzeEmotionalSaturation(message: string): number {
  // 간단한 감정 포화도 분석
  // 실제로는 Echotion 연동 필요
  
  const emotionalIndicators = [
    '😢', '😭', '💔', '😔', '😞', '😿',  // 슬픔
    '...', '..', '。。',                   // 여운
    '하아', '휴', '에휴',                  // 한숨
  ];
  
  let score = 0;
  emotionalIndicators.forEach(indicator => {
    if (message.includes(indicator)) {
      score += 0.2;
    }
  });
  
  // 짧은 메시지도 감정적일 수 있음
  if (message.length < 10) {
    score += 0.1;
  }
  
  return Math.min(score, 1);
}

// ==================== 스토어 생성 ====================

export const useLSPStore = create<LSPStore>((set, get) => ({
  // 초기 상태
  state: 'dormant',
  silenceScore: 0,
  factors: {
    emotionalSaturation: 0,
    implicitRequest: 0,
    presenceSeeking: 0,
    griefExpression: 0,
    contemplativeState: 0,
  },
  
  resonanceTimer: null,
  silenceTimer: null,
  
  lspExperienceCount: 0,
  showTooltip: false,
  
  lastInputTime: 0,
  silenceDuration: 0,
  
  // ==================== 공개 액션 ====================
  
  startListening: () => {
    const { state, _transitionTo, _clearTimers } = get();
    
    if (state === 'dormant' || state === 'silencing') {
      _clearTimers();
      _transitionTo('listening');
    }
  },
  
  submitInput: (message: string) => {
    const { _transitionTo, _evaluateInput } = get();
    
    set({ lastInputTime: Date.now() });
    _transitionTo('evaluating');
    
    // 비동기 평가 시뮬레이션
    setTimeout(() => {
      _evaluateInput(message);
    }, 800); // 평가 시간
  },
  
  completeResponse: () => {
    const { _transitionTo } = get();
    _transitionTo('listening');
  },
  
  presenceSignal: () => {
    const { state } = get();
    
    // Silencing 상태에서 터치 시 "I'm here" 시그널
    if (state === 'silencing') {
      // 진동 피드백 (있다면)
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      
      // 일시적으로 opacity 증가 효과는 CSS에서 처리
      // 여기서는 이벤트만 발생
    }
  },
  
  reset: () => {
    const { _clearTimers } = get();
    _clearTimers();
    
    set({
      state: 'dormant',
      silenceScore: 0,
      factors: {
        emotionalSaturation: 0,
        implicitRequest: 0,
        presenceSeeking: 0,
        griefExpression: 0,
        contemplativeState: 0,
      },
      showTooltip: false,
    });
  },
  
  // ==================== 내부 액션 ====================
  
  _transitionTo: (newState: LSPState) => {
    set({ state: newState });
  },
  
  _evaluateInput: (message: string) => {
    const { 
      _transitionTo, 
      _startResonanceTimer,
      lastInputTime,
      lspExperienceCount,
    } = get();
    
    // 사유 상태 계산 (이전 침묵 시간 기반)
    // lastInputTime이 0인 경우 (첫 입력) silenceDuration을 0으로 설정
    const silenceDuration = lastInputTime ? Date.now() - lastInputTime : 0;
    const contemplativeState = silenceDuration > 10000 ? 0.5 : 0;
    
    // 침묵 요소 분석
    const factors: SilenceFactors = {
      emotionalSaturation: analyzeEmotionalSaturation(message),
      implicitRequest: detectImplicitRequest(message),
      presenceSeeking: detectPresenceSeeking(message),
      griefExpression: detectGrief(message),
      contemplativeState,
    };
    
    const silenceScore = calculateSilenceScore(factors);
    
    set({ 
      factors, 
      silenceScore,
      silenceDuration,
    });
    
    // 침묵 점수에 따라 분기
    if (silenceScore >= 0.6) {
      // 침묵 선택
      _transitionTo('resonating');
      _startResonanceTimer();
      
      // 첫 LSP 경험 시 툴팁 표시
      if (lspExperienceCount === 0) {
        setTimeout(() => {
          set({ showTooltip: true, lspExperienceCount: 1 });
          
          // 5초 후 툴팁 숨김
          setTimeout(() => {
            set({ showTooltip: false });
          }, 5000);
        }, 3000);
      }
    } else {
      // 응답 생성
      _transitionTo('responding');
    }
  },
  
  _startResonanceTimer: () => {
    const { _transitionTo, _startSilenceTimer, _clearTimers } = get();
    
    _clearTimers();
    
    // 2초 후 Silencing으로 전이
    const timer = setTimeout(() => {
      _transitionTo('silencing');
      _startSilenceTimer();
    }, 2000);
    
    set({ resonanceTimer: timer });
  },
  
  _startSilenceTimer: () => {
    const { _transitionTo, _clearTimers } = get();
    
    // 8초 후 Dormant로 전이
    const timer = setTimeout(() => {
      _transitionTo('dormant');
      _clearTimers();
    }, 8000);
    
    set({ silenceTimer: timer });
  },
  
  _clearTimers: () => {
    const { resonanceTimer, silenceTimer } = get();
    
    if (resonanceTimer) {
      clearTimeout(resonanceTimer);
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    
    set({ resonanceTimer: null, silenceTimer: null });
  },
}));

