/**
 * LogViewer - Organism Component
 * 실시간 로그 뷰어
 */
import { useRef, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/atoms/Button';
import { LogLine, type LogEntry, type LogType } from '@/components/molecules/LogLine';

export interface LogViewerProps {
  logs: LogEntry[];
  maxLines?: number;
  autoScroll?: boolean;
  onExport?: () => void;
  onClear?: () => void;
  className?: string;
}

const LOG_TYPE_FILTERS: { value: LogType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'ALL' },
  { value: 'WS', label: 'WS' },
  { value: 'TASK', label: 'TASK' },
  { value: 'ERROR', label: 'ERR' },
];

export function LogViewer({
  logs,
  maxLines = 500,
  autoScroll = true,
  onExport,
  onClear,
  className,
}: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState<LogType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);

  // 필터링된 로그
  const filteredLogs = logs
    .filter((log) => {
      if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .slice(-maxLines);

  // 자동 스크롤
  useEffect(() => {
    if (isAutoScrollEnabled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, isAutoScrollEnabled]);

  // 수동 스크롤 감지 (자동 스크롤 비활성화)
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScrollEnabled(isAtBottom);
  };

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span>📜</span>
          <span>LOGS</span>
          <span className="text-xs text-gray-500">({filteredLogs.length})</span>
        </h3>

        {/* 타입 필터 */}
        <div className="flex gap-1">
          {LOG_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
              className={clsx(
                'px-2 py-1 rounded text-xs transition-colors',
                typeFilter === filter.value
                  ? 'bg-doai-black-600 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-doai-black-700'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="Search logs..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-2 px-3 py-1.5 text-xs rounded bg-doai-black-900 border border-doai-black-700 text-gray-300 placeholder-gray-600"
      />

      {/* 로그 영역 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-doai-black-900 rounded-lg p-2 font-mono"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No logs to display
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredLogs.map((log) => (
              <LogLine key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* 푸터 액션 */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
            className={clsx(
              'px-2 py-1 rounded',
              isAutoScrollEnabled ? 'bg-doai-yellow-500/20 text-doai-yellow-500' : 'hover:bg-doai-black-700'
            )}
          >
            {isAutoScrollEnabled ? '⏬ Auto-scroll ON' : '⏸ Auto-scroll OFF'}
          </button>
        </div>

        <div className="flex gap-2">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              Export
            </Button>
          )}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

