/**
 * IconButton Component (Atom)
 * 아이콘 전용 버튼 (네비게이션, 툴바 등)
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import { ReactNode, ButtonHTMLAttributes } from 'react';

export type IconButtonVariant = 'ghost' | 'outline' | 'filled';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 아이콘 (이모지 또는 컴포넌트) */
  icon: ReactNode;
  /** 접근성 레이블 */
  label: string;
  /** 버튼 변형 */
  variant?: IconButtonVariant;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 활성 상태 */
  active?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

const variantConfig = {
  ghost: {
    base: 'bg-transparent hover:bg-white/10',
    active: 'bg-white/20',
  },
  outline: {
    base: 'bg-transparent border border-gray-600 hover:border-gray-400 hover:bg-white/5',
    active: 'border-doai-400 bg-doai-400/10',
  },
  filled: {
    base: 'bg-gray-700 hover:bg-gray-600',
    active: 'bg-doai-400 text-room-900',
  },
};

const sizeConfig = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-base',
  lg: 'w-11 h-11 text-lg',
};

export function IconButton({ 
  icon, 
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  className,
  ...props 
}: IconButtonProps) {
  const styles = variantConfig[variant];
  
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-all',
        'focus:outline-none focus:ring-2 focus:ring-doai-400/50',
        sizeConfig[size],
        active ? styles.active : styles.base,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

