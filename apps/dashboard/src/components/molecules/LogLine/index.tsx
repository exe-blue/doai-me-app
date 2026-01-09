/**
 * LogLine - Molecular Component
 * 로그 뷰어의 개별 로그 라인
 */
import { clsx } from 'clsx';

export type LogType = 'WS' | 'TASK' | 'ERROR' | 'INFO' | 'DEBUG';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  message: string;
  direction?: 'in' | 'out'; // WebSocket 방향
  metadata?: Record<string, unknown>;
}

export interface LogLineProps {
  log: LogEntry;
  highlight?: boolean;
  showTimestamp?: boolean;
  onClick?: () => void;
}

// 타입별 색상
const typeColors: Record<LogType, string> = {
  WS: 'text-activity-surfing',
  TASK: 'text-activity-mining',
  ERROR: 'text-error',
  INFO: 'text-info',
  DEBUG: 'text-gray-500',
};

// 방향 아이콘
const directionIcons: Record<string, string> = {
  in: '←',
  out: '→',
};

export function LogLine({
  log,
  highlight = false,
  showTimestamp = true,
  onClick,
}: LogLineProps) {
  const typeColor = typeColors[log.type] || 'text-gray-400';
  const directionIcon = log.direction ? directionIcons[log.direction] : '';

  return (
    <div
      className={clsx(
        'font-mono text-xs py-0.5 px-2 rounded',
        'hover:bg-doai-black-700 transition-colors cursor-pointer',
        highlight && 'bg-doai-yellow-500/10 border-l-2 border-doai-yellow-500'
      )}
      onClick={onClick}
    >
      {/* 타임스탬프 */}
      {showTimestamp && (
        <span className="text-gray-600 mr-2">
          {log.timestamp}
        </span>
      )}

      {/* 타입 배지 */}
      <span className={clsx('mr-2', typeColor)}>
        [{log.type}]
      </span>

      {/* 방향 (WebSocket) */}
      {directionIcon && (
        <span className={clsx('mr-1', typeColor)}>
          {directionIcon}
        </span>
      )}

      {/* 메시지 */}
      <span className={clsx(
        log.type === 'ERROR' ? 'text-error' : 'text-gray-300'
      )}>
        {log.message}
      </span>
    </div>
  );
}

