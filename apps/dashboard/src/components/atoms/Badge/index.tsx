/**
 * Badge - Atomic Component
 * Variants: status, activity, connection, count
 */
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

// Status Types
type StatusType = 'online' | 'offline' | 'busy' | 'idle';
type ActivityType = 'mining' | 'surfing' | 'response' | 'labor' | 'idle';
type ConnectionType = 'usb' | 'wifi' | 'lan';

export interface BadgeProps {
  variant: 'status' | 'activity' | 'connection' | 'count';
  value: StatusType | ActivityType | ConnectionType | number | string;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  className?: string;
}

// 색상 매핑
const statusColors: Record<StatusType, string> = {
  online: 'bg-status-online/20 text-status-online',
  offline: 'bg-status-offline/20 text-status-offline',
  busy: 'bg-status-busy/20 text-status-busy',
  idle: 'bg-status-idle/20 text-status-idle',
};

const activityColors: Record<ActivityType, string> = {
  mining: 'bg-activity-mining/20 text-activity-mining',
  surfing: 'bg-activity-surfing/20 text-activity-surfing',
  response: 'bg-activity-response/20 text-activity-response',
  labor: 'bg-activity-labor/20 text-activity-labor',
  idle: 'bg-gray-500/20 text-gray-500',
};

const connectionColors: Record<ConnectionType, string> = {
  usb: 'bg-connection-usb/20 text-connection-usb',
  wifi: 'bg-connection-wifi/20 text-connection-wifi',
  lan: 'bg-connection-lan/20 text-connection-lan',
};

// 아이콘 매핑
const activityIcons: Record<ActivityType, string> = {
  mining: '🎭',
  surfing: '🍿',
  response: '🔥',
  labor: '💰',
  idle: '💤',
};

const connectionIcons: Record<ConnectionType, string> = {
  usb: '🔌',
  wifi: '📶',
  lan: '🔗',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
};

export function Badge({ variant, value, size = 'md', icon, className }: BadgeProps) {
  let colorClass = '';
  let displayIcon = icon;
  let displayText = String(value).toUpperCase();

  switch (variant) {
    case 'status':
      colorClass = statusColors[value as StatusType] || 'bg-gray-500/20 text-gray-500';
      break;
    case 'activity':
      colorClass = activityColors[value as ActivityType] || 'bg-gray-500/20 text-gray-500';
      displayIcon = displayIcon || activityIcons[value as ActivityType];
      break;
    case 'connection':
      colorClass = connectionColors[value as ConnectionType] || 'bg-gray-500/20 text-gray-500';
      displayIcon = displayIcon || connectionIcons[value as ConnectionType];
      break;
    case 'count':
      colorClass = 'bg-doai-yellow-500/20 text-doai-yellow-500';
      displayText = String(value);
      break;
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        colorClass,
        sizeStyles[size],
        className
      )}
    >
      {displayIcon && <span>{displayIcon}</span>}
      <span>{displayText}</span>
    </span>
  );
}

