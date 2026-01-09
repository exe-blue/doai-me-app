/**
 * Input - Atomic Component
 * Types: text, password, email, search
 * States: default, focus, error, disabled
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  label?: string;
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error = false,
      errorMessage,
      leftIcon,
      rightIcon,
      label,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm text-gray-400 mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full bg-doai-black-800 border rounded-lg text-gray-100 placeholder-gray-500',
              'focus:outline-none focus:ring-1 transition-all duration-200',
              sizeStyles[size],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-error focus:border-error focus:ring-error'
                : 'border-doai-black-600 focus:border-doai-yellow-500 focus:ring-doai-yellow-500',
              props.disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {rightIcon}
            </span>
          )}
        </div>
        {error && errorMessage && (
          <p className="mt-1 text-sm text-error">{errorMessage}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

