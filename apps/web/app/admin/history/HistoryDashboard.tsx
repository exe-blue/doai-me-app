'use client';

/**
 * HistoryDashboard - 히스토리 전체 조회 대시보드
 * 
 * 명령 내역, 시청 결과, 워크로드 히스토리를 필터/검색하여 조회합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Download, 
  RefreshCw,
  Filter,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  Smartphone,
  Play,
  Video,
  Calendar
} from 'lucide-react';
import styles from './HistoryDashboard.module.css';

// ============================================
// Types
// ============================================

type TabType = 'commands' | 'watches' | 'workloads';

interface CommandHistory {
  id: string;
  device_id: string | null;
  device_hierarchy_id: string | null;
  workstation_id: string | null;
  command_type: string;
  command_data: Record<string, unknown>;
  status: string;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  workload_id: string | null;
  sent_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface WatchResult {
  id: string;
  video_id: string;
  device_id: string;
  watch_time: number;
  watch_percent: number | null;
  liked: boolean;
  commented: boolean;
  error_message: string | null;
  created_at: string;
  videos: { id: string; title: string; url: string } | null;
  devices: { id: string; serial_number: string; hierarchy_id: string; model: string } | null;
}

interface WorkloadItem {
  id: string;
  name: string | null;
  video_ids: string[];
  current_video_index: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================
// Component
// ============================================

export function HistoryDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('commands');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);
  
  // 데이터
  const [commands, setCommands] = useState<CommandHistory[]>([]);
  const [watches, setWatches] = useState<WatchResult[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/history?type=${activeTab}&limit=${limit}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await res.json();

      switch (activeTab) {
        case 'commands':
          setCommands(data.commands || []);
          setStats(data.stats || {});
          break;
        case 'watches':
          setWatches(data.results || []);
          setStats(data.stats || {});
          break;
        case 'workloads':
          setWorkloads(data.workloads || []);
          setStats(data.stats || {});
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // CSV 내보내기
  const exportCSV = () => {
    let csvContent = '';
    let filename = '';

    switch (activeTab) {
      case 'commands':
        csvContent = 'ID,Device,Type,Status,Duration(ms),Created At,Error\n';
        csvContent += commands.map(cmd => 
          `${cmd.id},${cmd.device_hierarchy_id || ''},${cmd.command_type},${cmd.status},${cmd.duration_ms || ''},${cmd.created_at},${cmd.error_message || ''}`
        ).join('\n');
        filename = 'command_history.csv';
        break;
      case 'watches':
        csvContent = 'ID,Video,Device,Watch Time,Watch %,Liked,Created At\n';
        csvContent += watches.map(w => 
          `${w.id},${w.videos?.title || ''},${w.devices?.hierarchy_id || ''},${w.watch_time},${w.watch_percent || ''},${w.liked},${w.created_at}`
        ).join('\n');
        filename = 'watch_history.csv';
        break;
      case 'workloads':
        csvContent = 'ID,Name,Status,Videos,Completed,Failed,Created At\n';
        csvContent += workloads.map(wl => 
          `${wl.id},${wl.name || ''},${wl.status},${wl.video_ids.length},${wl.completed_tasks},${wl.failed_tasks},${wl.created_at}`
        ).join('\n');
        filename = 'workload_history.csv';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 상태 필터링
  const filteredCommands = commands.filter(cmd => {
    if (statusFilter !== 'all' && cmd.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cmd.device_hierarchy_id?.toLowerCase().includes(query) ||
        cmd.command_type.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredWatches = watches.filter(w => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        w.videos?.title?.toLowerCase().includes(query) ||
        w.devices?.hierarchy_id?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredWorkloads = workloads.filter(wl => {
    if (statusFilter !== 'all' && wl.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return wl.name?.toLowerCase().includes(query);
    }
    return true;
  });

  // 상태 아이콘
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'pending':
      case 'listing':
      case 'executing':
      case 'recording':
      case 'waiting':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-neutral-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-400" />;
    }
  };

  // 시간 포맷
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl text-neutral-200 font-mono tracking-wider flex items-center gap-2">
            <History className="w-5 h-5" />
            HISTORY
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            명령 내역, 시청 결과, 워크로드 히스토리
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* CSV 내보내기 */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>

          {/* 새로고침 */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-neutral-800">
        {[
          { id: 'commands' as const, label: '명령 내역', icon: Smartphone, count: commands.length },
          { id: 'watches' as const, label: '시청 결과', icon: Eye, count: watches.length },
          { id: 'workloads' as const, label: '워크로드', icon: Play, count: workloads.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-purple-400 border-purple-400 bg-purple-400/5'
                : 'text-neutral-500 border-transparent hover:text-neutral-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
        {/* 검색 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:border-purple-500 outline-none"
          />
        </div>

        {/* 상태 필터 */}
        {activeTab !== 'watches' && (
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-8 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:border-purple-500 outline-none cursor-pointer"
            >
              <option value="all">모든 상태</option>
              {activeTab === 'commands' && (
                <>
                  <option value="success">성공</option>
                  <option value="failed">실패</option>
                  <option value="timeout">타임아웃</option>
                  <option value="pending">대기중</option>
                </>
              )}
              {activeTab === 'workloads' && (
                <>
                  <option value="pending">대기</option>
                  <option value="executing">실행중</option>
                  <option value="completed">완료</option>
                  <option value="cancelled">취소</option>
                  <option value="error">오류</option>
                </>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          </div>
        )}

        {/* 개수 제한 */}
        <div className="relative">
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="appearance-none px-4 py-2 pr-8 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:border-purple-500 outline-none cursor-pointer"
          >
            <option value={50}>50개</option>
            <option value={100}>100개</option>
            <option value={200}>200개</option>
            <option value={500}>500개</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
        </div>
      </div>

      {/* 통계 카드 */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(stats).map(([key, value]) => (
            <div 
              key={key}
              className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg"
            >
              <div className="text-xs text-neutral-500 uppercase">{key}</div>
              <div className="text-lg font-mono text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="p-4 bg-red-950 border border-red-900 rounded-lg text-red-400">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      )}

      {/* 명령 내역 테이블 */}
      {!loading && activeTab === 'commands' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">상태</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">디바이스</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">명령</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">시간</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">소요시간</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">오류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredCommands.map(cmd => (
                  <tr key={cmd.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3">
                      <StatusIcon status={cmd.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {cmd.device_hierarchy_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {cmd.command_type}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatDateTime(cmd.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-400">
                      {cmd.duration_ms ? `${(cmd.duration_ms / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="px-4 py-3 text-red-400 truncate max-w-[200px]">
                      {cmd.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredCommands.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              데이터가 없습니다
            </div>
          )}
        </div>
      )}

      {/* 시청 결과 테이블 */}
      {!loading && activeTab === 'watches' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">영상</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">디바이스</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">시청시간</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">시청률</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">좋아요</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredWatches.map(watch => (
                  <tr key={watch.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3 text-white truncate max-w-[200px]">
                      {watch.videos?.title || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {watch.devices?.hierarchy_id || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {Math.floor(watch.watch_time / 60)}:{String(watch.watch_time % 60).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-purple-500 ${styles.watchProgressBar}`}
                            style={{ '--progress-width': `${watch.watch_percent || 0}%` } as React.CSSProperties}
                          />
                        </div>
                        <span className="text-neutral-400 text-xs">
                          {(watch.watch_percent || 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {watch.liked ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-neutral-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatDateTime(watch.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredWatches.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              데이터가 없습니다
            </div>
          )}
        </div>
      )}

      {/* 워크로드 테이블 */}
      {!loading && activeTab === 'workloads' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">상태</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">이름</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">영상</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">진행률</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">완료/실패</th>
                  <th className="px-4 py-3 text-left text-neutral-400 font-medium">시작</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredWorkloads.map(wl => (
                  <tr key={wl.id} className="hover:bg-neutral-800/30">
                    <td className="px-4 py-3">
                      <StatusIcon status={wl.status} />
                    </td>
                    <td className="px-4 py-3 text-white">
                      {wl.name || '이름 없음'}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {wl.current_video_index + 1}/{wl.video_ids.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-green-500 ${styles.workloadProgressBar}`}
                            style={{ '--progress-width': `${wl.total_tasks > 0 ? (wl.completed_tasks / wl.total_tasks) * 100 : 0}%` } as React.CSSProperties}
                          />
                        </div>
                        <span className="text-neutral-400 text-xs font-mono">
                          {wl.total_tasks > 0 
                            ? ((wl.completed_tasks / wl.total_tasks) * 100).toFixed(1) 
                            : 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-400">{wl.completed_tasks}</span>
                      {' / '}
                      <span className="text-red-400">{wl.failed_tasks}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {wl.started_at ? formatDateTime(wl.started_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredWorkloads.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              데이터가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
