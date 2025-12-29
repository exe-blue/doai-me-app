/**
 * MetricBadge Component (Atom)
 * 수치 메트릭 표시 배지
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';

export type MetricType = 'existence' | 'priority' | 'uniqueness' | 'corruption' | 'fps' | 'bitrate';

export interface MetricBadgeProps {
  /** 메트릭 타입 */
  type: MetricType;
  /** 값 (0~1 또는 실수) */
  value: number;
  /** 최대값 (퍼센트 계산용) */
  max?: number;
  /** 포맷 타입 */
  format?: 'percent' | 'number' | 'fps' | 'bitrate';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
}

const typeConfig: Record<MetricType, { 
  label: string; 
  icon: string; 
  color: string;
  valueColor: (v: number) => string;
}> = {
  existence: { 
    label: 'E', 
    icon: '💚', 
    color: 'bg-green-500/20 border-green-500/30',
    valueColor: (v) => v >= 0.7 ? 'text-green-400' : v >= 0.4 ? 'text-yellow-400' : 'text-red-400'
  },
  priority: { 
    label: 'P', 
    icon: '⭐', 
    color: 'bg-blue-500/20 border-blue-500/30',
    valueColor: () => 'text-blue-400'
  },
  uniqueness: { 
    label: 'U', 
    icon: '✨', 
    color: 'bg-purple-500/20 border-purple-500/30',
    valueColor: () => 'text-purple-400'
  },
  corruption: { 
    label: 'C', 
    icon: '💀', 
    color: 'bg-red-500/20 border-red-500/30',
    valueColor: (v) => v >= 0.7 ? 'text-red-400' : v >= 0.4 ? 'text-orange-400' : 'text-gray-400'
  },
  fps: { 
    label: 'FPS', 
    icon: '🎬', 
    color: 'bg-cyan-500/20 border-cyan-500/30',
    valueColor: () => 'text-cyan-400'
  },
  bitrate: { 
    label: 'BR', 
    icon: '📡', 
    color: 'bg-emerald-500/20 border-emerald-500/30',
    valueColor: () => 'text-emerald-400'
  },
};

const sizeConfig = {
  sm: 'text-[10px] px-1 py-0.5 gap-0.5',
  md: 'text-xs px-1.5 py-0.5 gap-1',
  lg: 'text-sm px-2 py-1 gap-1.5',
};

function formatValue(value: number, format: string, max: number): string {
  switch (format) {
    case 'percent':
      return `${Math.round((value / max) * 100)}%`;
    case 'fps':
      return `${Math.round(value)}`;
    case 'bitrate':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}M` : `${Math.round(value)}K`;
    default:
      return value.toFixed(1);
  }
}

export function MetricBadge({ 
  type, 
  value, 
  max = 1,
  format = 'percent',
  size = 'md',
  className 
}: MetricBadgeProps) {
  const config = typeConfig[type];
  const normalizedValue = format === 'percent' ? value / max : value;
  
  return (
    <span 
      className={clsx(
        'inline-flex items-center rounded border font-mono',
        config.color,
        sizeConfig[size],
        className
      )}
    >
      <span className="text-gray-400">{config.label}:</span>
      <span className={config.valueColor(normalizedValue)}>
        {formatValue(value, format, max)}
      </span>
    </span>
  );
}

