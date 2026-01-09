/**
 * DeviceCell - Molecular Component
 * 대시보드 그리드에서 개별 디바이스를 표시하는 셀
 * 
 * States:
 * - ONLINE + Activity (MINING, SURFING, LABOR, RESPONSE)
 * - OFFLINE
 * - BUSY (RESPONSE 활성 중)
 * - Selected
 */
import { clsx } from 'clsx';
import { StatusDot } from '@/components/atoms/StatusDot';
import { ExistenceBar } from '@/components/atoms/ExistenceBar';

// 디바이스 타입
export interface Device {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IDLE';
  activity: 'MINING' | 'SURFING' | 'RESPONSE' | 'LABOR' | 'IDLE' | null;
  existenceScore: number;
  connection: 'USB' | 'WIFI' | 'LAN';
  battery: number;
  credits: number;
}

export interface DeviceCellProps {
  device: Device;
  selected?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}

// Activity 아이콘
const ACTIVITY_ICONS: Record<string, string> = {
  MINING: '🎭',
  SURFING: '🍿',
  RESPONSE: '🔥',
  LABOR: '💰',
  IDLE: '💤',
};

// Activity별 테두리 색상
const ACTIVITY_BORDER_COLORS: Record<string, string> = {
  MINING: 'border-activity-mining',
  SURFING: 'border-activity-surfing',
  RESPONSE: 'border-activity-response',
  LABOR: 'border-activity-labor',
  IDLE: 'border-doai-black-600',
};

// Status를 StatusDot 형식으로 변환
function mapStatusToDot(status: Device['status']): 'online' | 'offline' | 'busy' | 'idle' {
  switch (status) {
    case 'ONLINE': return 'online';
    case 'OFFLINE': return 'offline';
    case 'BUSY': return 'busy';
    case 'IDLE': return 'idle';
    default: return 'idle';
  }
}

export function DeviceCell({
  device,
  selected = false,
  onClick,
  onContextMenu,
  className,
}: DeviceCellProps) {
  const isOffline = device.status === 'OFFLINE';
  const isResponse = device.activity === 'RESPONSE';
  const activityIcon = device.activity ? ACTIVITY_ICONS[device.activity] : null;
  const borderColor = device.activity ? ACTIVITY_BORDER_COLORS[device.activity] : 'border-doai-black-700';

  return (
    <div
      className={clsx(
        'relative p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer',
        'min-w-[120px] h-[100px] flex flex-col gap-2',
        'bg-doai-black-800',
        // 선택됨 상태
        selected ? 'border-doai-yellow-500 shadow-glow-strong' : borderColor,
        // 오프라인 상태
        isOffline && 'opacity-60',
        // Response 활성 상태 (깜빡임)
        isResponse && 'animate-accident-flash',
        // 호버 효과
        !selected && 'hover:border-doai-black-500 hover:bg-doai-black-700',
        className
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* 상단: Status Dot + Activity Icon */}
      <div className="flex items-center justify-between">
        <StatusDot 
          status={mapStatusToDot(device.status)} 
          size="md"
          animated={device.status === 'BUSY'}
        />
        {activityIcon && !isOffline && (
          <span className="text-lg">{activityIcon}</span>
        )}
        {selected && (
          <span className="absolute top-2 right-8 text-doai-yellow-500">✓</span>
        )}
      </div>

      {/* 이름 */}
      <div className="font-medium text-sm truncate text-gray-100">
        {device.name}
      </div>

      {/* Existence Bar */}
      <ExistenceBar 
        value={isOffline ? 0 : device.existenceScore} 
        size="sm"
        animated={!isOffline}
      />

      {/* 하단: 점수 + 상태 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {isOffline ? '--' : device.existenceScore.toFixed(2)}
        </span>
        <span className="uppercase">
          {isOffline ? 'OFFLINE' : device.activity || 'IDLE'}
        </span>
      </div>
    </div>
  );
}

