/**
 * ControlButton Component (Molecule)
 * 디바이스 제어 버튼 (Back, Home, Recent, 스크린샷 등)
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import { ReactNode } from 'react';

export type ControlType = 'back' | 'home' | 'recent' | 'screenshot' | 'restart' | 'custom';

export interface ControlButtonProps {
  /** 제어 타입 */
  type: ControlType;
  /** 커스텀 아이콘 */
  icon?: ReactNode;
  /** 커스텀 레이블 */
  label?: string;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 변형 */
  variant?: 'default' | 'danger' | 'warning';
  /** 추가 CSS 클래스 */
  className?: string;
}

const typeConfig: Record<ControlType, { icon: string; label: string }> = {
  back: { icon: '◀', label: 'Back' },
  home: { icon: '🏠', label: 'Home' },
  recent: { icon: '⬛', label: 'Recent' },
  screenshot: { icon: '📷', label: 'Screenshot' },
  restart: { icon: '🔄', label: 'Restart' },
  custom: { icon: '⚡', label: 'Action' },
};

const sizeConfig = {
  sm: 'px-2 py-1.5 text-xs gap-1',
  md: 'px-3 py-2 text-sm gap-1.5',
  lg: 'px-4 py-2.5 text-base gap-2',
};

const variantConfig = {
  default: 'bg-room-700 hover:bg-room-600 text-white',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
  warning: 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30',
};

export function ControlButton({ 
  type, 
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'default',
  className 
}: ControlButtonProps) {
  const config = typeConfig[type];
  const displayIcon = icon ?? config.icon;
  const displayLabel = label ?? config.label;
  const isDisabled = disabled || loading;
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center rounded transition-all',
        'focus:outline-none focus:ring-2 focus:ring-doai-400/50',
        sizeConfig[size],
        variantConfig[variant],
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span className={loading ? 'animate-spin' : ''}>
        {loading ? '⏳' : displayIcon}
      </span>
      <span>{displayLabel}</span>
    </button>
  );
}

