'use client';

// ============================================
// CurrentlyWatchingPanel v4.0
// 현재 시청 중인 영상 + 디바이스 표시
// ============================================

import React from 'react';
import { Activity, Play, Pause, ExternalLink } from 'lucide-react';
import { Device, QueuedVideo } from '../../contexts/NodeContext';

interface CurrentlyWatchingPanelProps {
  devices: Device[];
  queuedVideos: QueuedVideo[];
  isDark: boolean;
}

export function CurrentlyWatchingPanel({
  devices,
  queuedVideos,
  isDark,
}: CurrentlyWatchingPanelProps) {
  // 미완료 순으로 정렬
  const runningVideos = queuedVideos
    .filter(v => v.status === 'running')
    .sort((a, b) => a.progress - b.progress);

  // 작업 중인 디바이스
  const busyDevices = devices.filter(d => d.status === 'busy');

  // 빈 큐 상태 UI
  if (runningVideos.length === 0) {
    return (
      <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="font-serif text-lg">현재 시청중</h3>
        </div>
        <EmptyWatchingState isDark={isDark} busyDevices={busyDevices} />
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg p-6`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="font-serif text-lg">현재 시청중</h3>
          <span className="text-xs font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded ml-2">
            {busyDevices.length} DEVICES ACTIVE
          </span>
        </div>
      </div>

      {/* 시청 중인 영상 목록 */}
      <div className="space-y-4">
        {runningVideos.map(video => (
          <WatchingVideoCard
            key={video.id}
            video={video}
            devices={devices}
            isDark={isDark}
          />
        ))}
      </div>

      {/* 
        참고: 작업 중인 디바이스 목록은 EmptyWatchingState 컴포넌트에서 처리됨
        runningVideos.length === 0인 경우 이미 early return 되므로 이 블록은 도달 불가 
      */}
    </div>
  );
}

// ============================================
// 빈 상태 컴포넌트
// ============================================

function EmptyWatchingState({ isDark, busyDevices }: { isDark: boolean; busyDevices: Device[] }) {
  // 디바이스가 바쁘지만 등록된 영상이 없는 경우
  if (busyDevices.length > 0) {
    return (
      <div className="py-4">
        <div className="text-sm text-[#FFCC00] mb-3">
          {busyDevices.length}개 디바이스가 작업 중입니다
        </div>
        <div className="flex flex-wrap gap-2">
          {busyDevices.map(device => (
            <div
              key={device.id}
              className="flex items-center gap-2 px-3 py-2 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded"
            >
              <div className="w-2 h-2 bg-[#FFCC00] rounded-full animate-pulse" />
              <span className="text-sm font-medium">{device.name}</span>
              {device.currentTask && (
                <span className="text-xs text-neutral-400 truncate max-w-[200px]">
                  "{device.currentTask.title}"
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
        <Pause className="w-8 h-8 text-neutral-500" />
      </div>
      <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
        대기 중인 영상이 실행되면 여기에 표시됩니다
      </p>
      <p className={`text-xs mt-2 ${isDark ? 'text-neutral-600' : 'text-neutral-500'}`}>
        영상을 등록하고 시청을 시작하세요
      </p>
    </div>
  );
}

// ============================================
// 시청 중인 영상 카드
// ============================================

interface WatchingVideoCardProps {
  video: QueuedVideo;
  devices: Device[];
  isDark: boolean;
}

function WatchingVideoCard({ video, devices, isDark }: WatchingVideoCardProps) {
  const assignedDeviceCount = video.assignedDevices.length;
  const progressPercent = Math.round(video.progress);

  return (
    <div className={`${isDark ? 'bg-black/30 border-white/5' : 'bg-white border-black/5'} border rounded-lg p-4 transition-all hover:border-[#FFCC00]/30`}>
      {/* 상단: 영상 정보 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 재생 아이콘 */}
          <div className="w-10 h-10 bg-[#FFCC00]/20 rounded flex items-center justify-center relative">
            <Play className="w-5 h-5 text-[#FFCC00]" />
            <div className="absolute inset-0 bg-[#FFCC00]/20 rounded animate-ping opacity-75" />
          </div>
          
          {/* 제목 및 URL */}
          <div>
            <h4 className="font-bold text-sm flex items-center gap-2">
              {video.title}
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
            </h4>
            <p className="text-xs text-neutral-500 font-mono truncate max-w-[300px]">
              {video.url || 'No URL provided'}
            </p>
          </div>
        </div>

        {/* 진행 상황 */}
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-[#FFCC00]">
            {video.currentViews}<span className="text-neutral-500 text-sm">/{video.targetViews}</span>
          </div>
          <div className="text-xs text-neutral-500">{progressPercent}% 완료</div>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className={`h-2 ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'} rounded-full overflow-hidden mb-3`}>
        <div
          className="h-full bg-gradient-to-r from-[#FFCC00] to-yellow-500 transition-all duration-500 relative"
          style={{ width: `${video.progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* 참여 디바이스 미니 그리드 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-neutral-500 mr-2">참여 디바이스 ({assignedDeviceCount}):</span>
        {video.assignedDevices.slice(0, 30).map(deviceId => {
          const device = devices.find(d => d.id === deviceId);
          const isBusy = device?.status === 'busy';
          return (
            <div
              key={deviceId}
              className={`w-3 h-3 rounded-sm transition-all ${
                isBusy
                  ? 'bg-[#FFCC00] shadow-[0_0_6px_rgba(255,204,0,0.6)] animate-pulse'
                  : 'bg-green-400/60'
              }`}
              title={device?.name || deviceId}
            />
          );
        })}
        {video.assignedDevices.length > 30 && (
          <span className="text-xs text-neutral-500">+{video.assignedDevices.length - 30}</span>
        )}
      </div>
    </div>
  );
}
