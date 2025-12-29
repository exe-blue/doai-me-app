/**
 * GlobalActionButton Component (Atom)
 * 전역 액션 버튼 (Accident, Pop, Zombie 등)
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import { ReactNode } from 'react';

export type ActionVariant = 'accident' | 'pop' | 'zombie' | 'rescan' | 'default';

export interface GlobalActionButtonProps {
  /** 버튼 변형 */
  variant?: ActionVariant;
  /** 아이콘 (커스텀) */
  icon?: ReactNode;
  /** 레이블 */
  label: string;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
}

const variantConfig: Record<ActionVariant, { 
  icon: string; 
  bg: string; 
  hover: string;
  ring: string;
}> = {
  accident: { 
    icon: '🔥', 
    bg: 'bg-red-600', 
    hover: 'hover:bg-red-500',
    ring: 'ring-red-500/50'
  },
  pop: { 
    icon: '🍿', 
    bg: 'bg-purple-600', 
    hover: 'hover:bg-purple-500',
    ring: 'ring-purple-500/50'
  },
  zombie: { 
    icon: '💤', 
    bg: 'bg-yellow-600', 
    hover: 'hover:bg-yellow-500',
    ring: 'ring-yellow-500/50'
  },
  rescan: { 
    icon: '🔄', 
    bg: 'bg-gray-600', 
    hover: 'hover:bg-gray-500',
    ring: 'ring-gray-500/50'
  },
  default: { 
    icon: '⚡', 
    bg: 'bg-doai-400', 
    hover: 'hover:bg-doai-300',
    ring: 'ring-doai-400/50'
  },
};

const sizeConfig = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
};

export function GlobalActionButton({ 
  variant = 'default',
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  size = 'md',
  className 
}: GlobalActionButtonProps) {
  const config = variantConfig[variant];
  const isDisabled = disabled || loading;
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center rounded font-medium transition-all',
        'focus:outline-none focus:ring-2',
        config.bg,
        config.hover,
        config.ring,
        sizeConfig[size],
        isDisabled && 'opacity-50 cursor-not-allowed',
        variant === 'default' ? 'text-room-900' : 'text-white',
        className
      )}
    >
      {loading ? (
        <span className="animate-spin">⏳</span>
      ) : (
        <span>{icon ?? config.icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}

