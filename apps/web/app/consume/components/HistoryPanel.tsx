'use client';

/**
 * HistoryPanel - 히스토리 패널 컴포넌트
 * 
 * 최근 명령 내역, 시청 완료, 현재 워크로드 상태를 표시합니다.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Smartphone,
  Video
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface CommandHistory {
  id: string;
  device_hierarchy_id: string;
  command_type: string;
  status: 'pending' | 'sent' | 'success' | 'failed' | 'timeout';
  duration_ms: number | null;
  created_at: string;
  error_message: string | null;
}

interface WatchResult {
  id: string;
  video_title: string;
  device_count: number;
  success_count: number;
  failed_count: number;
  total_watch_time: number;
  completed_at: string;
}

interface ActiveWorkload {
  id: string;
  name: string;
  status: string;
  video_count: number;
  current_video_index: number;
  progress_percent: number;
  completed_tasks: number;
  total_tasks: number;
}

interface HistoryData {
  recent_commands: CommandHistory[];
  recent_watches: WatchResult[];
  active_workloads: ActiveWorkload[];
}

interface HistoryPanelProps {
  isDark: boolean;
}

// ============================================
// Component
// ============================================

export function HistoryPanel({ isDark }: HistoryPanelProps) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'commands' | 'watches' | 'workloads'>('commands');

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/history?type=summary&limit=10');
      
      if (!res.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드 + 폴링 (30초)
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // 상태 아이콘
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'pending':
      case 'sent':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-400" />;
    }
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 명령 타입 한글화
  const getCommandLabel = (type: string) => {
    const labels: Record<string, string> = {
      'watch': '시청',
      'tap': '탭',
      'swipe': '스와이프',
      'adb': 'ADB',
      'home': '홈',
      'back': '뒤로'
    };
    return labels[type] || type;
  };

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-xl overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              히스토리
            </h3>
            <p className="text-xs text-neutral-500">
              최근 명령 및 시청 내역
            </p>
          </div>
        </div>
        
        {/* 새로고침 */}
        <button
          onClick={loadData}
          disabled={loading}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`} />
        </button>
      </div>

      {/* 탭 */}
      <div className={`flex border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        {[
          { id: 'commands' as const, label: '명령', icon: Smartphone },
          { id: 'watches' as const, label: '시청', icon: Eye },
          { id: 'workloads' as const, label: '워크로드', icon: Play }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? isDark 
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5' 
                  : 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : isDark
                  ? 'text-neutral-500 hover:text-white'
                  : 'text-neutral-500 hover:text-black'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'workloads' && data?.active_workloads.length ? (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full">
                {data.active_workloads.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        )}

        {/* 명령 내역 */}
        {activeTab === 'commands' && data && (
          <div className="space-y-2">
            {data.recent_commands.length === 0 ? (
              <EmptyState message="최근 명령 내역이 없습니다" isDark={isDark} />
            ) : (
              data.recent_commands.map(cmd => (
                <div
                  key={cmd.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isDark ? 'bg-black/30' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={cmd.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                          {getCommandLabel(cmd.command_type)}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {cmd.device_hierarchy_id}
                        </span>
                      </div>
                      {cmd.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]">
                          {cmd.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-500">
                      {formatTime(cmd.created_at)}
                    </div>
                    {cmd.duration_ms && (
                      <div className="text-[10px] text-neutral-600 font-mono">
                        {(cmd.duration_ms / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 시청 내역 */}
        {activeTab === 'watches' && data && (
          <div className="space-y-2">
            {data.recent_watches.length === 0 ? (
              <EmptyState message="최근 시청 내역이 없습니다" isDark={isDark} />
            ) : (
              data.recent_watches.map(watch => (
                <div
                  key={watch.id}
                  className={`p-3 rounded-lg ${isDark ? 'bg-black/30' : 'bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-purple-400 shrink-0" />
                        <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-black'}`}>
                          {watch.video_title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                        <span className="text-green-400">
                          ✓ {watch.success_count}
                        </span>
                        {watch.failed_count > 0 && (
                          <span className="text-red-400">
                            ✗ {watch.failed_count}
                          </span>
                        )}
                        <span>
                          {Math.floor(watch.total_watch_time / 60)}분 시청
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatTime(watch.completed_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 활성 워크로드 */}
        {activeTab === 'workloads' && data && (
          <div className="space-y-3">
            {data.active_workloads.length === 0 ? (
              <EmptyState message="실행 중인 워크로드가 없습니다" isDark={isDark} />
            ) : (
              data.active_workloads.map(wl => (
                <div
                  key={wl.id}
                  className={`p-4 rounded-lg border ${
                    isDark 
                      ? 'bg-green-500/5 border-green-500/20' 
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                        {wl.name}
                      </span>
                    </div>
                    <span className="text-xs text-green-400 font-mono uppercase">
                      {wl.status}
                    </span>
                  </div>
                  
                  {/* 진행률 바 */}
                  <div className={`h-2 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-black/30' : 'bg-gray-200'}`}>
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${wl.progress_percent}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      영상 {wl.current_video_index + 1}/{wl.video_count}
                    </span>
                    <span>
                      {wl.completed_tasks}/{wl.total_tasks} 완료
                    </span>
                    <span className="font-mono">
                      {wl.progress_percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 더보기 링크 */}
      <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <a
          href="/admin/history"
          className={`flex items-center justify-center gap-1 text-sm ${
            isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-500'
          } transition-colors`}
        >
          전체 히스토리 보기
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// ============================================
// 빈 상태 컴포넌트
// ============================================

function EmptyState({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
        isDark ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <History className="w-6 h-6 text-neutral-500" />
      </div>
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}
