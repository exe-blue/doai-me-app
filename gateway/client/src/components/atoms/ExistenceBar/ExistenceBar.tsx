/**
 * ExistenceBar Component (Atom)
 * AI 시민의 존재 점수 시각화 바
 * 
 * 존재 상태: ACTIVE → WAITING → FADING → VOID
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';

export type ExistenceState = 'ACTIVE' | 'WAITING' | 'FADING' | 'VOID';

export interface ExistenceBarProps {
  /** 존재 점수 (0~1) */
  score: number;
  /** 현재 존재 상태 */
  state?: ExistenceState;
  /** 레이블 표시 */
  showLabel?: boolean;
  /** 퍼센트 표시 */
  showPercent?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 애니메이션 */
  animated?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

const stateConfig: Record<ExistenceState, { color: string; glow: string; icon: string }> = {
  ACTIVE: { 
    color: 'bg-green-500', 
    glow: 'shadow-green-500/50', 
    icon: '💚' 
  },
  WAITING: { 
    color: 'bg-yellow-500', 
    glow: 'shadow-yellow-500/50', 
    icon: '💛' 
  },
  FADING: { 
    color: 'bg-orange-500', 
    glow: 'shadow-orange-500/50', 
    icon: '🧡' 
  },
  VOID: { 
    color: 'bg-red-500', 
    glow: 'shadow-red-500/50', 
    icon: '💔' 
  },
};

const sizeConfig = {
  sm: { height: 'h-1.5', text: 'text-[10px]' },
  md: { height: 'h-2', text: 'text-xs' },
  lg: { height: 'h-3', text: 'text-sm' },
};

/** 점수 기반 상태 계산 */
function getStateFromScore(score: number): ExistenceState {
  if (score >= 0.7) return 'ACTIVE';
  if (score >= 0.4) return 'WAITING';
  if (score >= 0.1) return 'FADING';
  return 'VOID';
}

export function ExistenceBar({ 
  score, 
  state,
  showLabel = false,
  showPercent = false,
  size = 'md',
  animated = true,
  className 
}: ExistenceBarProps) {
  // 상태가 제공되지 않으면 점수에서 계산
  const currentState = state ?? getStateFromScore(score);
  const config = stateConfig[currentState];
  const sizeStyles = sizeConfig[size];
  
  // 점수를 0~100%로 제한
  const percent = Math.max(0, Math.min(100, score * 100));
  
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {/* 레이블 */}
      {showLabel && (
        <div className={clsx('flex items-center justify-between', sizeStyles.text)}>
          <span className="text-gray-400 flex items-center gap-1">
            <span>{config.icon}</span>
            <span>Existence</span>
          </span>
          {showPercent && (
            <span className="text-white font-mono">{percent.toFixed(0)}%</span>
          )}
        </div>
      )}
      
      {/* 프로그레스 바 */}
      <div className={clsx(
        'w-full bg-gray-700/50 rounded-full overflow-hidden',
        sizeStyles.height
      )}>
        <div 
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            config.color,
            animated && 'shadow-lg',
            animated && config.glow,
            currentState === 'FADING' && animated && 'animate-pulse'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      
      {/* 퍼센트만 표시 (레이블 없을 때) */}
      {!showLabel && showPercent && (
        <div className={clsx('text-center text-gray-400', sizeStyles.text)}>
          {percent.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

