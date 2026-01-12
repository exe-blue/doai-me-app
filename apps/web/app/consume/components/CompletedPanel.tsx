'use client';

// ============================================
// CompletedPanel - 완료 목록 패널
// ============================================

import React from 'react';
import { CheckCircle2, Clock, ExternalLink, TrendingUp, AlertTriangle } from 'lucide-react';
import { CompletedVideo } from '../../contexts/NodeContext';

interface CompletedPanelProps {
  completedVideos: CompletedVideo[];
  isDark: boolean;
}

export function CompletedPanel({ completedVideos, isDark }: CompletedPanelProps) {
  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg p-5 mb-10`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-neutral-500" />
          <h3 className="font-serif text-lg">완료 목록</h3>
          <span className={`text-xs font-mono ${isDark ? 'text-neutral-500 bg-white/5' : 'text-neutral-600 bg-black/5'} px-2 py-0.5 rounded ml-2`}>
            {completedVideos.length} COMPLETED
          </span>
        </div>

        {/* 통계 요약 */}
        {completedVideos.length > 0 && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-green-400">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              총 {completedVideos.reduce((sum, v) => sum + v.totalViews, 0)} views
            </span>
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      {completedVideos.length === 0 ? (
        <EmptyCompletedState isDark={isDark} />
      ) : (
        <CompletedTable completedVideos={completedVideos} isDark={isDark} />
      )}
    </div>
  );
}

// ============================================
// 빈 완료 목록 상태
// ============================================

function EmptyCompletedState({ isDark }: { isDark: boolean }) {
  return (
    <div className="text-center py-8">
      <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
        <CheckCircle2 className="w-6 h-6 text-neutral-500" />
      </div>
      <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
        완료된 영상이 없습니다
      </p>
      <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
        영상 시청이 완료되면 여기에 기록됩니다
      </p>
    </div>
  );
}

// ============================================
// 완료 목록 테이블
// ============================================

interface CompletedTableProps {
  completedVideos: CompletedVideo[];
  isDark: boolean;
}

function CompletedTable({ completedVideos, isDark }: CompletedTableProps) {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
  };

  const formatCompletedTime = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className={`border-b ${isDark ? 'border-white/10' : 'border-black/10'} text-[10px]`}>
            <th className="text-left pb-3 font-sans text-neutral-500 font-semibold uppercase tracking-wider">영상</th>
            <th className="text-left pb-3 font-sans text-neutral-500 font-semibold uppercase tracking-wider">완료 시간</th>
            <th className="text-right pb-3 font-sans text-neutral-500 font-semibold uppercase tracking-wider">소요 시간</th>
            <th className="text-right pb-3 font-sans text-neutral-500 font-semibold uppercase tracking-wider">결과</th>
          </tr>
        </thead>
        <tbody>
          {completedVideos.map(video => (
            <tr
              key={video.id}
              className={`border-b ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-black/5'} transition-colors`}
            >
              {/* 영상 정보 */}
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{video.title}</span>
                  {video.url && (
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 hover:text-[#FFCC00] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </td>

              {/* 완료 시간 */}
              <td className="py-3">
                <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatCompletedTime(video.completedAt)}</span>
                </div>
              </td>

              {/* 소요 시간 */}
              <td className="py-3 text-right">
                <span className="text-xs font-mono text-neutral-400">
                  {formatDuration(video.duration)}
                </span>
              </td>

              {/* 결과 */}
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-3 text-sm font-mono">
                  <span className="text-green-400" title="성공">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    {video.successCount}
                  </span>
                  {video.errorCount > 0 && (
                    <span className="text-red-400" title="오류">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {video.errorCount}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

