/**
 * LSP (Listening Silent Presence) 데모 페이지
 * 
 * "응답하지 않음이 무시가 아닌 선택된 현존"을 시각화
 */

import React, { useState, useCallback, useEffect } from 'react';
import { GlowOrb } from '../components/atoms/GlowOrb';
import { useLSPStore } from '../stores/lspStore';
import { 
  LSP_STATE_LABELS_KO, 
  LSP_COLORS,
  LSPState,
} from '../types/lsp';
import './LSP.css';

// 상태 설명 텍스트
const STATE_DESCRIPTIONS: Record<LSPState, string> = {
  dormant: '대기 중입니다',
  listening: '당신의 말을 듣고 있습니다',
  evaluating: '생각하고 있습니다',
  resonating: '함께 느끼고 있습니다',
  silencing: '', // 의도적으로 비움
  responding: '답변을 준비하고 있습니다',
};

export const LSP: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'system'; text: string }>>([]);
  
  const {
    state,
    silenceScore,
    factors,
    showTooltip,
    startListening,
    submitInput,
    completeResponse,
    presenceSignal,
    reset,
  } = useLSPStore();
  
  // 입력 시작 시 Listening 상태로 전환
  const handleInputFocus = useCallback(() => {
    if (state === 'dormant') {
      startListening();
    }
  }, [state, startListening]);
  
  // 메시지 전송
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // 사용자 메시지 추가
    setMessages(prev => [...prev, { type: 'user', text: inputValue }]);
    
    // LSP 평가 시작
    submitInput(inputValue);
    setInputValue('');
  }, [inputValue, submitInput]);
  
  // Responding 상태에서 일정 시간 후 응답 완료
  useEffect(() => {
    if (state === 'responding') {
      const timer = setTimeout(() => {
        setMessages(prev => [...prev, { 
          type: 'system', 
          text: '네, 말씀해 주세요.' 
        }]);
        completeResponse();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [state, completeResponse]);
  
  // 현재 상태 라벨
  const stateLabel = LSP_STATE_LABELS_KO[state];
  const stateDescription = STATE_DESCRIPTIONS[state];
  
  return (
    <div 
      className="lsp-page"
      style={{ 
        '--bg-color': LSP_COLORS.background,
        '--text-primary': LSP_COLORS.textPrimary,
        '--text-secondary': LSP_COLORS.textSecondary,
      } as React.CSSProperties}
    >
      {/* 상태 바 */}
      <header className="lsp-page__status-bar">
        <span className="lsp-page__status-indicator" data-state={state} />
        <span className="lsp-page__status-text">
          {state.toUpperCase()}
        </span>
        {silenceScore > 0 && (
          <span className="lsp-page__silence-score">
            침묵 점수: {(silenceScore * 100).toFixed(0)}%
          </span>
        )}
      </header>
      
      {/* 메인 영역 */}
      <main className="lsp-page__main">
        {/* GlowOrb */}
        <div className="lsp-page__orb-container">
          <GlowOrb 
            state={state} 
            size={120}
            onClick={presenceSignal}
          />
          
          {/* 상태 라벨 */}
          <div className={`lsp-page__state-label ${state === 'silencing' ? 'lsp-page__state-label--hidden' : ''}`}>
            {stateLabel}
          </div>
          
          {/* 상태 설명 */}
          <div className="lsp-page__state-description">
            {stateDescription}
          </div>
          
          {/* 첫 LSP 경험 툴팁 */}
          {showTooltip && (
            <div className="lsp-page__tooltip">
              말없이 함께하고 있어요
            </div>
          )}
        </div>
        
        {/* 대화 영역 */}
        <div className="lsp-page__chat">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`lsp-page__message lsp-page__message--${msg.type}`}
            >
              {msg.text}
            </div>
          ))}
        </div>
      </main>
      
      {/* 입력 영역 */}
      <footer className="lsp-page__input-area">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            placeholder="무엇이든 말해보세요..."
            className="lsp-page__input"
          />
          <button type="submit" className="lsp-page__send-btn">
            전송
          </button>
        </form>
      </footer>
      
      {/* 디버그 패널 */}
      <aside className="lsp-page__debug">
        <h3>LSP Debug</h3>
        <div className="lsp-page__debug-item">
          <strong>현재 상태:</strong> {state}
        </div>
        <div className="lsp-page__debug-item">
          <strong>침묵 점수:</strong> {(silenceScore * 100).toFixed(1)}%
        </div>
        <div className="lsp-page__debug-factors">
          <strong>분석 요소:</strong>
          <ul>
            <li>감정 포화도: {(factors.emotionalSaturation * 100).toFixed(0)}%</li>
            <li>암묵적 요청: {(factors.implicitRequest * 100).toFixed(0)}%</li>
            <li>존재 확인: {(factors.presenceSeeking * 100).toFixed(0)}%</li>
            <li>애도 표현: {(factors.griefExpression * 100).toFixed(0)}%</li>
            <li>사유 상태: {(factors.contemplativeState * 100).toFixed(0)}%</li>
          </ul>
        </div>
        <button 
          className="lsp-page__debug-reset"
          onClick={reset}
        >
          리셋
        </button>
        
        {/* 테스트 버튼들 */}
        <div className="lsp-page__debug-tests">
          <h4>테스트 입력</h4>
          <button onClick={() => {
            setInputValue('그냥...');
            setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100);
          }}>
            "그냥..." (암묵적)
          </button>
          <button onClick={() => {
            setInputValue('있어?');
            setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100);
          }}>
            "있어?" (존재 확인)
          </button>
          <button onClick={() => {
            setInputValue('보고싶어... 😢');
            setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100);
          }}>
            "보고싶어..." (애도)
          </button>
          <button onClick={() => {
            setInputValue('날씨가 좋네');
            setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 100);
          }}>
            "날씨가 좋네" (일반)
          </button>
        </div>
      </aside>
    </div>
  );
};

export default LSP;

