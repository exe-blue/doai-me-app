/**
 * LogLine Component (Molecule)
 * 로그 뷰어에서 단일 로그 라인 표시
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface LogLineProps {
  /** 타임스탬프 */
  timestamp: string | Date;
  /** 로그 레벨 */
  level: LogLevel;
  /** 소스 (모듈/컴포넌트 이름) */
  source?: string;
  /** 메시지 */
  message: string;
  /** 상세 데이터 (JSON) */
  data?: Record<string, unknown>;
  /** 확장 상태 */
  expanded?: boolean;
  /** 클릭 핸들러 (확장 토글) */
  onClick?: () => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

const levelConfig: Record<LogLevel, { icon: string; color: string; bg: string }> = {
  info: { icon: 'ℹ️', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warn: { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  error: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10' },
  debug: { icon: '🔧', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  success: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/10' },
};

function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

export function LogLine({ 
  timestamp, 
  level, 
  source,
  message,
  data,
  expanded = false,
  onClick,
  className 
}: LogLineProps) {
  const config = levelConfig[level];
  const hasData = data && Object.keys(data).length > 0;
  
  return (
    <div 
      className={clsx(
        'font-mono text-xs border-l-2 pl-2 py-1 transition-colors',
        config.bg,
        expanded && 'bg-white/5',
        hasData && 'cursor-pointer hover:bg-white/5',
        className
      )}
      style={{ borderLeftColor: `var(--tw-${config.color.replace('text-', '')})` }}
      onClick={hasData ? onClick : undefined}
    >
      {/* 메인 라인 */}
      <div className="flex items-start gap-2">
        {/* 타임스탬프 */}
        <span className="text-gray-500 shrink-0">
          {formatTimestamp(timestamp)}
        </span>
        
        {/* 레벨 아이콘 */}
        <span className="shrink-0">{config.icon}</span>
        
        {/* 소스 */}
        {source && (
          <span className="text-purple-400 shrink-0">[{source}]</span>
        )}
        
        {/* 메시지 */}
        <span className={clsx('flex-1', config.color)}>
          {message}
        </span>
        
        {/* 확장 인디케이터 */}
        {hasData && (
          <span className="text-gray-500 shrink-0">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      
      {/* 확장된 데이터 */}
      {expanded && hasData && (
        <pre className="mt-2 p-2 bg-black/30 rounded text-[10px] text-gray-400 overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

