

// ============================================
// WatchedStatsBar v4.0
// 시청 통계 바
// ============================================

import React, { useState, useEffect } from 'react';
import { Eye, Clock, TrendingUp, Zap, Smartphone, Monitor } from 'lucide-react';
import { SystemStats } from '@/contexts/NodeContext';

interface WatchedStatsBarProps {
  stats: SystemStats;
  queuedCount: number;
  runningCount: number;
  isDark: boolean;
}

// 시간 포맷팅 함수 (일관된 형식)
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function WatchedStatsBar({
  stats,
  queuedCount,
  runningCount,
  isDark,
}: WatchedStatsBarProps) {
  // 클라이언트 마운트 후에만 시간 표시 (hydration 오류 방지)
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Use requestAnimationFrame to avoid synchronous setState in effect
    const frame = requestAnimationFrame(() => {
      setMounted(true);
      setCurrentTime(new Date());
    });

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg px-6 py-3 flex items-center justify-between`}>
      <div className="flex items-center gap-8 font-mono text-sm">
        {/* 시청 아이콘 */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#FFCC00]" />
          <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>시청 현황</span>
        </div>

        <div className="h-4 w-px bg-current opacity-20" />

        {/* 노드/디바이스 상태 */}
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3 h-3 text-blue-400" />
          <span>노드:</span>
          <strong className="text-blue-400">{stats.onlineNodes}/{stats.totalNodes}</strong>
        </div>

        <div className="flex items-center gap-1.5">
          <Smartphone className="w-3 h-3 text-green-400" />
          <span>디바이스:</span>
          <strong className="text-green-400">{stats.idleDevices + stats.busyDevices}/{stats.totalDevices}</strong>
        </div>

        <div className="h-4 w-px bg-current opacity-20" />

        {/* 오늘 시청 */}
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-[#FFCC00]" />
          <span>Today:</span>
          <strong className="text-[#FFCC00]">{stats.todayViews}</strong>
        </div>

        {/* 전체 시청 */}
        <span>
          Total: <strong className={isDark ? 'text-white' : 'text-black'}>{stats.totalViews}</strong>
        </span>

        {/* 대기열 */}
        <span>
          Queue: <strong className="text-green-400">{queuedCount}</strong>
        </span>

        {/* 실행 중 */}
        {runningCount > 0 && (
          <div className="flex items-center gap-1.5 text-[#FFCC00]">
            <Zap className="w-3 h-3 animate-pulse" />
            <span>Running: <strong>{runningCount}</strong></span>
          </div>
        )}
      </div>

      {/* 현재 시간 - 클라이언트에서만 렌더링 */}
      <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
        <Clock className="w-3 h-3" />
        <span suppressHydrationWarning>
          {mounted && currentTime ? formatTime(currentTime) : '--:--:--'}
        </span>
      </div>
    </div>
  );
}
