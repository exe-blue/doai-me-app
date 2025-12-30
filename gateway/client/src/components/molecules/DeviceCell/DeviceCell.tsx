/**
 * DeviceCell Component (Molecule)
 * Hive 그리드에서 단일 디바이스를 표시하는 셀
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';
import { ConnectionTypeBadge, ExistenceBar, MetricBadge } from '../../atoms';
import type { DiscoveredDevice } from '../../../types';

export interface DeviceCellProps {
  /** 디바이스 정보 */
  device: DiscoveredDevice;
  /** 셀 너비 */
  width: number;
  /** 셀 높이 */
  height: number;
  /** 선택 상태 */
  selected?: boolean;
  /** 스트림 표시 여부 */
  showStream?: boolean;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 더블클릭 핸들러 (상세 페이지 이동) */
  onDoubleClick?: () => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

export function DeviceCell({ 
  device, 
  width, 
  height,
  selected = false,
  showStream = true,
  onClick,
  onDoubleClick,
  className 
}: DeviceCellProps) {
  const isOnline = device.status === 'ONLINE';
  const existenceScore = device.metrics?.existence_score ?? 0.5;
  
  return (
    <div
      className={clsx(
        'relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200',
        'border hover:border-doai-400',
        selected ? 'ring-2 ring-doai-400 border-doai-400' : 'border-room-600',
        isOnline ? 'bg-room-800' : 'bg-room-800/50 opacity-70',
        className
      )}
      style={{ width, height }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 스트림/오프라인 영역 */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {isOnline && showStream ? (
          <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
            <span className="text-gray-600 text-2xl">📺</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl opacity-50">📵</span>
            <span className="text-xs text-gray-500">Offline</span>
          </div>
        )}
      </div>
      
      {/* 상단 오버레이: 상태 배지 */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
        {/* 연결 상태 */}
        <div className="flex items-center gap-1">
          <span className={clsx(
            'w-2 h-2 rounded-full',
            isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          )} />
          {device.gatewayClientConnected && (
            <span className="text-[10px]">🔗</span>
          )}
        </div>
        
        {/* 연결 타입 */}
        <ConnectionTypeBadge type={device.connectionType} size="sm" iconOnly />
      </div>
      
      {/* 하단 오버레이: 디바이스 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        {/* 이름/ID */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white font-medium truncate max-w-[70%]">
            {device.aiCitizen?.name ?? device.serial.slice(0, 10)}
          </span>
          <span className="text-sm">{getExistenceEmoji(existenceScore)}</span>
        </div>
        
        {/* Existence Bar */}
        <ExistenceBar score={existenceScore} size="sm" />
        
        {/* 메트릭 (선택적) */}
        {device.metrics && (
          <div className="flex gap-1 mt-1.5">
            <MetricBadge type="priority" value={device.metrics.priority ?? 0.5} size="sm" />
            <MetricBadge type="corruption" value={device.metrics.corruption ?? 0} size="sm" />
          </div>
        )}
      </div>
      
      {/* 선택 인디케이터 */}
      {selected && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-2xl opacity-50">✓</span>
        </div>
      )}
    </div>
  );
}

function getExistenceEmoji(score: number): string {
  if (score >= 0.7) return '💚';
  if (score >= 0.4) return '💛';
  if (score >= 0.1) return '🧡';
  return '💔';
}

