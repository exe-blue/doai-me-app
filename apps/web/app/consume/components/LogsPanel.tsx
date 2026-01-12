'use client';

// ============================================
// LogsPanel v5.0 - 실시간 로그 패널
// 카테고리별 필터링 및 깔끔한 UI
// ============================================

import React, { useRef, useEffect, useState } from 'react';
import { 
  Activity, CheckCircle2, AlertCircle, Info, RotateCcw, 
  Download, ChevronDown, Filter, X, Wifi, Smartphone, Video, Globe, Settings
} from 'lucide-react';
import { LogEntry, useNodes } from '../../contexts/NodeContext';

interface LogsPanelProps {
  logs: LogEntry[];
  isDark: boolean;
}

const LOGS_PER_PAGE = 30;
const MAX_DISPLAY_LOGS = 150;

// 카테고리 설정
const CATEGORIES = {
  all: { label: '전체', icon: Activity, color: 'text-neutral-400' },
  connection: { label: '연결', icon: Wifi, color: 'text-blue-400' },
  device: { label: '디바이스', icon: Smartphone, color: 'text-purple-400' },
  video: { label: '영상', icon: Video, color: 'text-green-400' },
  kernel: { label: 'Kernel', icon: Globe, color: 'text-cyan-400' },
  system: { label: '시스템', icon: Settings, color: 'text-neutral-400' },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

export function LogsPanel({ logs, isDark }: LogsPanelProps) {
  const { clearLogs } = useNodes();
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const [displayCount, setDisplayCount] = useState(LOGS_PER_PAGE);
  const [levelFilter, setLevelFilter] = useState<LogEntry['level'] | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // 필터링된 로그
  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    return true;
  });

  const displayedLogs = filteredLogs.slice(0, displayCount);
  const hasMore = displayCount < filteredLogs.length && displayCount < MAX_DISPLAY_LOGS;
  const remainingCount = Math.min(filteredLogs.length - displayCount, MAX_DISPLAY_LOGS - displayCount);

  // 새 로그 추가 시 자동 스크롤
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs.length, autoScroll]);

  const handleLoadMore = () => {
    setDisplayCount(prev => Math.min(prev + LOGS_PER_PAGE, MAX_DISPLAY_LOGS));
  };

  const handleClear = () => {
    clearLogs();
    setDisplayCount(LOGS_PER_PAGE);
  };

  const handleExport = () => {
    const logText = logs
      .map(log => {
        const timestamp = log.timestamp instanceof Date 
          ? log.timestamp.toISOString() 
          : log.timestamp;
        const category = log.category ? `[${log.category}]` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${category} ${log.message}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doai-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 레벨별 통계
  const levelStats = {
    all: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    success: logs.filter(l => l.level === 'success').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  };

  // 카테고리별 통계
  const categoryStats = Object.keys(CATEGORIES).reduce((acc, key) => {
    if (key === 'all') {
      acc[key] = logs.length;
    } else {
      acc[key] = logs.filter(l => l.category === key).length;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`col-span-12 md:col-span-5 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg p-5 flex flex-col min-h-[300px]`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <h3 className="font-serif text-lg">실시간 로그</h3>
          <span className={`text-xs font-mono ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
            ({displayedLogs.length}/{filteredLogs.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 필터 버튼 */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-1.5 rounded flex items-center gap-1 ${
                (levelFilter !== 'all' || categoryFilter !== 'all')
                  ? 'bg-[#FFCC00]/20 text-[#FFCC00]' 
                  : isDark ? 'hover:bg-white/10 text-neutral-500' : 'hover:bg-black/10 text-neutral-500'
              } transition-colors`}
              title="필터"
            >
              <Filter className="w-4 h-4" />
              {(levelFilter !== 'all' || categoryFilter !== 'all') && (
                <span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full" />
              )}
            </button>

            {isFilterOpen && (
              <FilterDropdown
                isDark={isDark}
                levelFilter={levelFilter}
                categoryFilter={categoryFilter}
                levelStats={levelStats}
                categoryStats={categoryStats}
                onLevelChange={(level) => {
                  setLevelFilter(level);
                  setDisplayCount(LOGS_PER_PAGE);
                }}
                onCategoryChange={(category) => {
                  setCategoryFilter(category);
                  setDisplayCount(LOGS_PER_PAGE);
                }}
                onClose={() => setIsFilterOpen(false)}
              />
            )}
          </div>

          {/* 자동 스크롤 토글 */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded ${
              autoScroll 
                ? 'bg-green-500/20 text-green-400' 
                : isDark ? 'hover:bg-white/10 text-neutral-500' : 'hover:bg-black/10 text-neutral-500'
            } transition-colors`}
            title={autoScroll ? '자동 스크롤 켜짐' : '자동 스크롤 꺼짐'}
          >
            <ChevronDown className={`w-4 h-4 ${autoScroll ? 'animate-bounce' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-colors`}
            title="로그 내보내기"
            disabled={logs.length === 0}
          >
            <Download className="w-4 h-4 text-neutral-500" />
          </button>
          
          <button
            onClick={handleClear}
            className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-colors`}
            title="로그 초기화"
          >
            <RotateCcw className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* 활성 필터 표시 */}
      {(levelFilter !== 'all' || categoryFilter !== 'all') && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {levelFilter !== 'all' && (
            <FilterBadge
              label={levelFilter}
              onRemove={() => setLevelFilter('all')}
              color={getLevelColor(levelFilter)}
              isDark={isDark}
            />
          )}
          {categoryFilter !== 'all' && (
            <FilterBadge
              label={CATEGORIES[categoryFilter].label}
              onRemove={() => setCategoryFilter('all')}
              color={CATEGORIES[categoryFilter].color}
              isDark={isDark}
            />
          )}
          <button
            onClick={() => { setLevelFilter('all'); setCategoryFilter('all'); }}
            className="text-[10px] text-neutral-500 hover:text-[#FFCC00] transition-colors"
          >
            모두 해제
          </button>
        </div>
      )}

      {/* 로그 목록 */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto font-mono text-xs space-y-0.5 pr-2"
      >
        {displayedLogs.length === 0 ? (
          <EmptyLogsState isDark={isDark} hasFilter={levelFilter !== 'all' || categoryFilter !== 'all'} />
        ) : (
          <>
            {displayedLogs.map(log => (
              <LogItem key={log.id} log={log} isDark={isDark} />
            ))}

            {hasMore && (
              <LoadMoreButton
                onClick={handleLoadMore}
                remainingCount={remainingCount}
                isDark={isDark}
              />
            )}

            {displayCount >= MAX_DISPLAY_LOGS && filteredLogs.length > MAX_DISPLAY_LOGS && (
              <MaxLimitNotice
                totalCount={filteredLogs.length}
                maxCount={MAX_DISPLAY_LOGS}
                isDark={isDark}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// 필터 배지
// ============================================

function FilterBadge({ label, onRemove, color, isDark }: { 
  label: string; 
  onRemove: () => void; 
  color: string;
  isDark: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
      isDark ? 'bg-white/10' : 'bg-black/10'
    }`}>
      <span className={color}>{label}</span>
      <button onClick={onRemove} className="hover:text-red-400">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ============================================
// 필터 드롭다운
// ============================================

interface FilterDropdownProps {
  isDark: boolean;
  levelFilter: LogEntry['level'] | 'all';
  categoryFilter: CategoryKey;
  levelStats: Record<string, number>;
  categoryStats: Record<string, number>;
  onLevelChange: (level: LogEntry['level'] | 'all') => void;
  onCategoryChange: (category: CategoryKey) => void;
  onClose: () => void;
}

function FilterDropdown({ 
  isDark, 
  levelFilter, 
  categoryFilter, 
  levelStats, 
  categoryStats,
  onLevelChange, 
  onCategoryChange,
  onClose 
}: FilterDropdownProps) {
  const levels: Array<{ key: LogEntry['level'] | 'all'; label: string; color: string }> = [
    { key: 'all', label: '전체', color: 'text-neutral-400' },
    { key: 'info', label: '정보', color: 'text-blue-400' },
    { key: 'success', label: '성공', color: 'text-green-400' },
    { key: 'warn', label: '경고', color: 'text-yellow-400' },
    { key: 'error', label: '오류', color: 'text-red-400' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className={`absolute right-0 top-full mt-1 z-50 ${isDark ? 'bg-neutral-900 border-white/10' : 'bg-white border-black/10'} border rounded-lg shadow-xl py-2 min-w-[200px]`}>
        {/* 레벨 필터 */}
        <div className="px-3 py-1">
          <span className="text-[10px] font-medium text-neutral-500 uppercase">레벨</span>
        </div>
        {levels.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => onLevelChange(key)}
            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between ${
              levelFilter === key
                ? isDark ? 'bg-white/10' : 'bg-black/5'
                : isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
            } transition-colors`}
          >
            <span className={color}>{label}</span>
            <span className={isDark ? 'text-neutral-600' : 'text-neutral-400'}>
              {levelStats[key]}
            </span>
          </button>
        ))}

        <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`} />

        {/* 카테고리 필터 */}
        <div className="px-3 py-1">
          <span className="text-[10px] font-medium text-neutral-500 uppercase">카테고리</span>
        </div>
        {(Object.entries(CATEGORIES) as Array<[CategoryKey, typeof CATEGORIES[CategoryKey]]>).map(([key, { label, icon: Icon, color }]) => (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between ${
              categoryFilter === key
                ? isDark ? 'bg-white/10' : 'bg-black/5'
                : isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
            } transition-colors`}
          >
            <span className={`flex items-center gap-2 ${color}`}>
              <Icon className="w-3 h-3" />
              {label}
            </span>
            <span className={isDark ? 'text-neutral-600' : 'text-neutral-400'}>
              {categoryStats[key]}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// ============================================
// 빈 로그 상태
// ============================================

function EmptyLogsState({ isDark, hasFilter }: { isDark: boolean; hasFilter: boolean }) {
  return (
    <div className={`text-center py-8 ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
      <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
      <p className="text-sm">
        {hasFilter ? '해당 필터의 로그가 없습니다' : '로그 대기 중...'}
      </p>
    </div>
  );
}

// ============================================
// 로그 아이템
// ============================================

interface LogItemProps {
  log: LogEntry;
  isDark: boolean;
}

function getLevelColor(level: LogEntry['level']) {
  switch (level) {
    case 'success': return 'text-green-400';
    case 'error': return 'text-red-400';
    case 'warn': return 'text-yellow-400';
    default: return 'text-blue-400';
  }
}

function LogItem({ log, isDark }: LogItemProps) {
  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return <CheckCircle2 className="w-3 h-3" />;
      case 'error': return <AlertCircle className="w-3 h-3" />;
      case 'warn': return <AlertCircle className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const getBorderColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      case 'warn': return '#eab308';
      default: return 'transparent';
    }
  };

  const getCategoryIcon = (category?: LogEntry['category']) => {
    if (!category || category === 'system') return null;
    const config = CATEGORIES[category as CategoryKey];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`w-3 h-3 ${config.color}`} />;
  };

  const timestamp = log.timestamp instanceof Date
    ? `${log.timestamp.getHours().toString().padStart(2, '0')}:${log.timestamp.getMinutes().toString().padStart(2, '0')}:${log.timestamp.getSeconds().toString().padStart(2, '0')}`
    : new Date(log.timestamp).toLocaleTimeString();

  return (
    <div
      className={`flex items-start gap-2 ${isDark ? 'border-white/5' : 'border-black/5'} border-l-2 pl-2 py-1.5 hover:bg-white/5 transition-colors rounded-r`}
      style={{ borderLeftColor: getBorderColor(log.level) }}
    >
      <span className={getLevelColor(log.level)}>
        {getLogIcon(log.level)}
      </span>
      <span className="text-neutral-600 whitespace-nowrap text-[10px]">
        {timestamp}
      </span>
      {getCategoryIcon(log.category)}
      <span className={`${isDark ? 'text-neutral-300' : 'text-neutral-700'} flex-1 break-words`}>
        {log.message}
      </span>
    </div>
  );
}

// ============================================
// 더 불러오기 버튼
// ============================================

interface LoadMoreButtonProps {
  onClick: () => void;
  remainingCount: number;
  isDark: boolean;
}

function LoadMoreButton({ onClick, remainingCount, isDark }: LoadMoreButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-2 mt-2 rounded border-2 border-dashed ${
        isDark 
          ? 'border-white/10 hover:border-[#FFCC00]/50 hover:bg-[#FFCC00]/5 text-neutral-400 hover:text-[#FFCC00]' 
          : 'border-black/10 hover:border-[#FFCC00]/50 hover:bg-[#FFCC00]/5 text-neutral-500 hover:text-[#D4A000]'
      } transition-all flex items-center justify-center gap-2 text-xs font-mono`}
    >
      <ChevronDown className="w-4 h-4" />
      더 불러오기 ({remainingCount}개)
    </button>
  );
}

// ============================================
// 최대 표시 알림
// ============================================

interface MaxLimitNoticeProps {
  totalCount: number;
  maxCount: number;
  isDark: boolean;
}

function MaxLimitNotice({ totalCount, maxCount, isDark }: MaxLimitNoticeProps) {
  return (
    <div className={`text-center py-2 mt-2 rounded ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
      <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
        최대 {maxCount}개 표시 (전체 {totalCount}개)
      </p>
    </div>
  );
}
