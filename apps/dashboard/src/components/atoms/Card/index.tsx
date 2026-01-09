/**
 * Card - Atomic Component
 * Variants: default, interactive, selected
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'selected';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
}

const variantStyles = {
  default: 'bg-doai-black-800 border-doai-black-700',
  interactive: `bg-doai-black-800 border-doai-black-700 cursor-pointer
                hover:border-doai-black-600 hover:bg-doai-black-700`,
  selected: 'bg-doai-black-800 border-doai-yellow-500 shadow-glow',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      header,
      footer,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-xl border transition-all duration-200',
          variantStyles[variant],
          !header && !footer && paddingStyles[padding],
          className
        )}
        {...props}
      >
        {header && (
          <div className="px-4 py-3 border-b border-doai-black-700">
            {header}
          </div>
        )}
        <div className={clsx((header || footer) && paddingStyles[padding])}>
          {children}
        </div>
        {footer && (
          <div className="px-4 py-3 border-t border-doai-black-700">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

