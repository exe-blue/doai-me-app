/**
 * StatusDot - Atomic Component
 * Status: online, offline, busy, idle
 */
import { clsx } from 'clsx';

export type StatusType = 'online' | 'offline' | 'busy' | 'idle' | 'connecting';

export interface StatusDotProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  online: 'bg-status-online',
  offline: 'bg-status-offline',
  busy: 'bg-status-busy',
  idle: 'bg-status-idle',
  connecting: 'bg-doai-yellow-500',
};

const sizeStyles = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function StatusDot({
  status,
  size = 'md',
  animated = false,
  className,
}: StatusDotProps) {
  const shouldAnimate = animated || status === 'busy' || status === 'connecting';

  return (
    <span
      className={clsx(
        'inline-block rounded-full',
        statusColors[status],
        sizeStyles[size],
        shouldAnimate && 'animate-pulse',
        className
      )}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
}

