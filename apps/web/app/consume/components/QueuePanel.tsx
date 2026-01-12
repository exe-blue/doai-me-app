'use client';

// ============================================
// QueuePanel - 시청 대기열 패널
// ============================================

import React from 'react';
import { Loader, Play, Pause, Trash2, Clock } from 'lucide-react';
import { QueuedVideo, useNodes } from '../../contexts/NodeContext';

interface QueuePanelProps {
  queuedVideos: QueuedVideo[];
  isDark: boolean;
}

export function QueuePanel({ queuedVideos, isDark }: QueuePanelProps) {
  const { updateVideo } = useNodes();
  const waitingVideos = queuedVideos.filter(v => v.status === 'queued');

  return (
    <div className={`col-span-12 md:col-span-7 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg p-5 flex flex-col min-h-[300px]`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Loader className="w-4 h-4 text-green-400 animate-spin" />
          <h3 className="font-serif text-lg">시청 대기열</h3>
          <span className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded ml-2">
            {waitingVideos.length} PENDING
          </span>
        </div>
      </div>

      {/* 대기열 목록 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {waitingVideos.length === 0 ? (
          <EmptyQueueState isDark={isDark} />
        ) : (
          waitingVideos.map((video, index) => (
            <QueueItem
              key={video.id}
              video={video}
              index={index}
              isDark={isDark}
              onStart={() => updateVideo({ id: video.id, status: 'running' })}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// 빈 대기열 상태
// ============================================

function EmptyQueueState({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
          <Pause className="w-6 h-6 text-neutral-500" />
        </div>
        <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
          대기 중인 영상이 없습니다
        </p>
        <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
          영상을 등록하면 여기에 표시됩니다
        </p>
      </div>
    </div>
  );
}

// ============================================
// 대기열 아이템
// ============================================

interface QueueItemProps {
  video: QueuedVideo;
  index: number;
  isDark: boolean;
  onStart: () => void;
}

function QueueItem({ video, index, isDark, onStart }: QueueItemProps) {
  const registeredTime = video.registeredAt instanceof Date 
    ? video.registeredAt.toLocaleTimeString() 
    : new Date(video.registeredAt).toLocaleTimeString();

  return (
    <div
      className={`${isDark ? 'bg-black/30 border-white/5 hover:border-[#FFCC00]/30' : 'bg-white border-black/5 hover:border-[#FFCC00]/30'} border rounded-lg p-3 transition-all group`}
    >
      <div className="flex items-center justify-between">
        {/* 좌측: 순번 + 정보 */}
        <div className="flex items-center gap-3">
          {/* 순번 */}
          <span className={`font-mono text-xs ${isDark ? 'text-neutral-600' : 'text-neutral-400'} w-6`}>
            #{index + 1}
          </span>

          {/* 영상 정보 */}
          <div>
            <h4 className="font-medium text-sm truncate max-w-[250px]">{video.title}</h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
              <Clock className="w-3 h-3" />
              <span>등록: {registeredTime}</span>
              <span className="text-neutral-600">•</span>
              <span>목표: {video.targetViews}</span>
            </div>
          </div>
        </div>

        {/* 우측: 액션 버튼 */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 시작 버튼 */}
          <button
            onClick={onStart}
            className="p-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            title="지금 시작"
          >
            <Play className="w-3 h-3" />
          </button>

          {/* 삭제 버튼 (TODO: 구현) */}
          <button
            className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

