/**
 * TabItem Component (Molecule)
 * 탭 바에서 사용하는 개별 탭 아이템
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import { ReactNode } from 'react';

export interface TabItemProps {
  /** 탭 ID */
  id: string;
  /** 아이콘 */
  icon?: ReactNode;
  /** 레이블 */
  label: string;
  /** 활성 상태 */
  active?: boolean;
  /** 배지 (알림 수 등) */
  badge?: number | string;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 */
  disabled?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 변형 (라인/필드) */
  variant?: 'line' | 'pill';
  /** 추가 CSS 클래스 */
  className?: string;
}

const sizeConfig = {
  sm: 'px-2.5 py-1.5 text-xs gap-1',
  md: 'px-3 py-2 text-sm gap-1.5',
  lg: 'px-4 py-2.5 text-base gap-2',
};

export function TabItem({ 
  id,
  icon,
  label,
  active = false,
  badge,
  onClick,
  disabled = false,
  size = 'md',
  variant = 'line',
  className 
}: TabItemProps) {
  const isLine = variant === 'line';
  
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center justify-center transition-all',
        'focus:outline-none focus:ring-2 focus:ring-doai-400/50',
        sizeConfig[size],
        // Line variant
        isLine && [
          'border-b-2',
          active 
            ? 'border-doai-400 text-doai-400' 
            : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600',
        ],
        // Pill variant
        !isLine && [
          'rounded-lg',
          active 
            ? 'bg-doai-400/20 text-doai-400 border border-doai-400/30' 
            : 'bg-transparent text-gray-400 hover:bg-white/5 hover:text-white',
        ],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* 아이콘 */}
      {icon && <span>{icon}</span>}
      
      {/* 레이블 */}
      <span>{label}</span>
      
      {/* 배지 */}
      {badge !== undefined && badge !== 0 && (
        <span className={clsx(
          'absolute -top-1 -right-1 min-w-[18px] h-[18px]',
          'flex items-center justify-center',
          'text-[10px] font-bold rounded-full',
          typeof badge === 'number' && badge > 0
            ? 'bg-red-500 text-white'
            : 'bg-gray-600 text-gray-300'
        )}>
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

