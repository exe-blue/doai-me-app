/**
 * ConnectionTypeBadge Component (Atom)
 * 디바이스 연결 타입 표시 배지
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import type { ConnectionType } from '../../../types';

export interface ConnectionTypeBadgeProps {
  /** 연결 타입 */
  type: ConnectionType;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 아이콘만 표시 */
  iconOnly?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

const typeConfig: Record<ConnectionType, { icon: string; label: string; color: string }> = {
  USB: { icon: '🔌', label: 'USB', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  WIFI: { icon: '📶', label: 'WiFi', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  LAN: { icon: '🌐', label: 'LAN', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

const sizeConfig = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
};

export function ConnectionTypeBadge({ 
  type, 
  size = 'md', 
  iconOnly = false,
  className 
}: ConnectionTypeBadgeProps) {
  const config = typeConfig[type];
  
  return (
    <span 
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border font-mono',
        config.color,
        sizeConfig[size],
        className
      )}
    >
      <span>{config.icon}</span>
      {!iconOnly && <span>{config.label}</span>}
    </span>
  );
}

