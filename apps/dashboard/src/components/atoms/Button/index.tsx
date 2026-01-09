/**
 * Button - Atomic Component
 * Variants: primary, secondary, danger, ghost
 * Sizes: sm, md, lg
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: `bg-doai-yellow-500 text-doai-black-900 font-semibold
            hover:bg-doai-yellow-400 hover:shadow-glow
            active:bg-doai-yellow-600
            disabled:opacity-50 disabled:cursor-not-allowed`,
  secondary: `bg-doai-black-700 text-gray-100 font-medium
              border border-doai-black-600
              hover:bg-doai-black-600 hover:border-doai-black-500
              active:bg-doai-black-800
              disabled:opacity-50 disabled:cursor-not-allowed`,
  danger: `bg-error text-white font-semibold
           hover:bg-red-600
           active:bg-red-700
           disabled:opacity-50 disabled:cursor-not-allowed`,
  ghost: `bg-transparent text-gray-300 font-medium
          hover:bg-doai-black-800 hover:text-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed`,
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-base rounded-lg',
  lg: 'px-6 py-3 text-lg rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-2 transition-all duration-200',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

