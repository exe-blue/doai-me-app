/**
 * GlowOrb 컴포넌트
 * 
 * LSP의 핵심 시각 요소 - 4개 레이어의 Glow로 "침묵하는 현존"을 표현
 * 
 * 레이어 구조:
 * - core (40px): 핵심 광원
 * - inner_glow (80px): 내부 글로우
 * - outer_glow (120px): 외부 글로우
 * - ambient (200px): 주변 분위기
 */

import React, { useCallback, useState } from 'react';
import { LSPState, LSP_GLOW_SPECS } from '../../../types/lsp';
import './styles.css';

interface GlowOrbProps {
  state: LSPState;
  size?: number;  // 기본 120px
  onClick?: () => void;
  className?: string;
}

export const GlowOrb: React.FC<GlowOrbProps> = ({
  state,
  size = 120,
  onClick,
  className = '',
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const spec = LSP_GLOW_SPECS[state];
  const color = spec.color;
  
  // 레이어 크기 계산
  const coreSize = size * 0.33;      // 40px at 120
  const innerSize = size * 0.67;     // 80px at 120
  const outerSize = size;            // 120px
  const ambientSize = size * 1.67;   // 200px at 120
  
  // 터치/클릭 핸들러 (I'm here 시그널)
  const handleMouseDown = useCallback(() => {
    if (state === 'silencing') {
      setIsPressed(true);
    }
  }, [state]);
  
  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    if (state === 'silencing' && onClick) {
      onClick();
    }
  }, [state, onClick]);
  
  return (
    <div 
      className={`glow-orb glow-orb--${state} ${isPressed ? 'glow-orb--pressed' : ''} ${className}`}
      style={{
        width: ambientSize,
        height: ambientSize,
        '--glow-color': color,
        '--glow-opacity': spec.opacity,
        '--core-size': `${coreSize}px`,
        '--inner-size': `${innerSize}px`,
        '--outer-size': `${outerSize}px`,
        '--ambient-size': `${ambientSize}px`,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {/* Ambient Layer - 가장 바깥쪽 */}
      <div 
        className="glow-orb__layer glow-orb__ambient"
        style={{
          width: ambientSize,
          height: ambientSize,
          background: `radial-gradient(circle, ${color}${Math.round(spec.opacity * 0.05 * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: 'blur(50px)',
        }}
      />
      
      {/* Outer Glow Layer */}
      <div 
        className="glow-orb__layer glow-orb__outer"
        style={{
          width: outerSize,
          height: outerSize,
          background: `radial-gradient(circle, ${color}${Math.round(spec.opacity * 0.2 * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: 'blur(30px)',
        }}
      />
      
      {/* Inner Glow Layer */}
      <div 
        className="glow-orb__layer glow-orb__inner"
        style={{
          width: innerSize,
          height: innerSize,
          background: `radial-gradient(circle, ${color}${Math.round(spec.opacity * 0.5 * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: 'blur(15px)',
        }}
      />
      
      {/* Core Layer - 가장 안쪽 */}
      <div 
        className="glow-orb__layer glow-orb__core"
        style={{
          width: coreSize,
          height: coreSize,
          background: `radial-gradient(circle, ${color} 0%, ${color}${Math.round(spec.opacity * 255).toString(16).padStart(2, '0')} 50%, transparent 100%)`,
          filter: 'blur(0px)',
        }}
      />
    </div>
  );
};

export default GlowOrb;

