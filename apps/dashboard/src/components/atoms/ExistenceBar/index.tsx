/**
 * ExistenceBar - Atomic Component
 * 존재 점수를 시각화하는 프로그레스 바
 * 
 * 색상 구간:
 * - 0.00-0.20: Critical (Red)
 * - 0.20-0.40: Low (Orange)
 * - 0.40-0.60: Medium (Yellow)
 * - 0.60-0.80: High (Lime)
 * - 0.80-1.00: Max (Green)
 */
import { clsx } from 'clsx';

export interface ExistenceBarProps {
  value: number; // 0-1 범위
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

// 존재 점수에 따른 색상 결정
function getExistenceColor(value: number): string {
  if (value < 0.2) return 'bg-existence-critical';
  if (value < 0.4) return 'bg-existence-low';
  if (value < 0.6) return 'bg-existence-medium';
  if (value < 0.8) return 'bg-existence-high';
  return 'bg-existence-max';
}

// 존재 상태 레이블
function getExistenceLabel(value: number): string {
  if (value < 0.2) return 'CRITICAL';
  if (value < 0.4) return 'LOW';
  if (value < 0.6) return 'MEDIUM';
  if (value < 0.8) return 'HIGH';
  return 'MAX';
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ExistenceBar({
  value,
  size = 'md',
  showLabel = false,
  animated = true,
  className,
}: ExistenceBarProps) {
  // 값을 0-1 범위로 클램프
  const clampedValue = Math.max(0, Math.min(1, value));
  const percentage = clampedValue * 100;
  const colorClass = getExistenceColor(clampedValue);

  return (
    <div className={clsx('w-full', className)}>
      {/* 프로그레스 바 */}
      <div
        className={clsx(
          'w-full bg-doai-black-700 rounded-full overflow-hidden',
          sizeStyles[size]
        )}
      >
        <div
          className={clsx(
            'h-full rounded-full',
            colorClass,
            animated && 'transition-all duration-500 ease-out'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 레이블 */}
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs">
          <span className={clsx(
            'font-medium',
            clampedValue < 0.2 ? 'text-existence-critical' :
            clampedValue < 0.4 ? 'text-existence-low' :
            clampedValue < 0.6 ? 'text-existence-medium' :
            clampedValue < 0.8 ? 'text-existence-high' :
            'text-existence-max'
          )}>
            {getExistenceLabel(clampedValue)}
          </span>
          <span className="text-gray-500">
            {clampedValue.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

