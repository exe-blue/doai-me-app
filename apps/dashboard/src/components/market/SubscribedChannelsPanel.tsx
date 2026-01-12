

// ============================================
// SubscribedChannelsPanel - 연동된 채널 관리 패널
// 채널 목록 조회, 설정 수정, 구독 해제
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rss,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Users,
  Video,
} from 'lucide-react';

interface SubscribedChannel {
  id: string;
  channel_id: string;
  channel_title: string;
  channel_handle?: string;
  thumbnail_url?: string;
  uploads_playlist_id?: string;
  subscriber_count?: number;
  video_count?: number;
  auto_register: boolean;
  target_views_default: number;
  priority: number;
  last_video_id?: string;
  last_checked_at?: string;
  subscribed_at: string;
  is_active: boolean;
  total_videos_registered?: number;
  total_views_generated?: number;
}

interface SubscribedChannelsPanelProps {
  isDark: boolean;
}

export function SubscribedChannelsPanel({ isDark }: SubscribedChannelsPanelProps) {
  const [channels, setChannels] = useState<SubscribedChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<'supabase' | 'memory'>('memory');

  // 채널 목록 조회
  const loadChannels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/youtube/subscribe');
      const data = await response.json();

      if (data.success) {
        setChannels(data.data || []);
        setStorageType(data.storage || 'memory');
      } else {
        setError(data.error || '채널 목록을 불러올 수 없습니다');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 로드
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // 자동 등록 토글
  const toggleAutoRegister = async (channelId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/youtube/subscribe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          autoRegister: !currentValue,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setChannels(prev =>
          prev.map(ch =>
            ch.channel_id === channelId
              ? { ...ch, auto_register: !currentValue }
              : ch
          )
        );
      }
    } catch (err) {
      console.error('Toggle auto register error:', err);
    }
  };

  // 목표 조회수 수정
  const updateTargetViews = async (channelId: string, targetViews: number) => {
    try {
      const response = await fetch('/api/youtube/subscribe', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          targetViewsDefault: targetViews,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setChannels(prev =>
          prev.map(ch =>
            ch.channel_id === channelId
              ? { ...ch, target_views_default: targetViews }
              : ch
          )
        );
        setEditingChannel(null);
      }
    } catch (err) {
      console.error('Update target views error:', err);
    }
  };

  // 채널 구독 해제
  const unsubscribe = async (channelId: string, permanent: boolean = false) => {
    const confirmMsg = permanent
      ? '이 채널을 완전히 삭제하시겠습니까? (복구 불가)'
      : '이 채널 구독을 해제하시겠습니까?';

    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch(
        `/api/youtube/subscribe?channelId=${channelId}&permanent=${permanent}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        if (permanent) {
          setChannels(prev => prev.filter(ch => ch.channel_id !== channelId));
        } else {
          setChannels(prev =>
            prev.map(ch =>
              ch.channel_id === channelId
                ? { ...ch, is_active: false }
                : ch
            )
          );
        }
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
    }
  };

  // 숫자 포맷팅
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 시간 포맷팅
  const formatTime = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`;
    return `${Math.floor(diffMins / 1440)}일 전`;
  };

  const activeChannels = channels.filter(ch => ch.is_active);
  const inactiveChannels = channels.filter(ch => !ch.is_active);

  return (
    <div
      className={`${
        isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'
      } backdrop-blur-md border rounded-lg overflow-hidden`}
    >
      {/* 헤더 */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
        } transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Rss className="w-5 h-5 text-purple-400" />
          <h3 className={`font-serif text-lg ${isDark ? 'text-white' : 'text-black'}`}>
            연동된 채널
          </h3>
          <span className="px-2 py-0.5 text-xs font-mono bg-purple-500/20 text-purple-400 rounded">
            {activeChannels.length}
          </span>
          {storageType === 'memory' && (
            <span className="px-2 py-0.5 text-[10px] font-mono bg-yellow-500/20 text-yellow-400 rounded">
              임시저장
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadChannels();
            }}
            className={`p-1.5 rounded ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
            } transition-colors`}
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      {isExpanded && (
        <div className="p-4 pt-0">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* 로딩 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
            </div>
          ) : channels.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              <Rss className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">연동된 채널이 없습니다</p>
              <p className="text-xs mt-1">상단의 '채널 연동' 탭에서 채널을 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 활성 채널 */}
              {activeChannels.map(channel => (
                <ChannelCard
                  key={channel.channel_id}
                  channel={channel}
                  isDark={isDark}
                  isEditing={editingChannel === channel.channel_id}
                  onToggleEdit={() =>
                    setEditingChannel(
                      editingChannel === channel.channel_id ? null : channel.channel_id
                    )
                  }
                  onToggleAutoRegister={() =>
                    toggleAutoRegister(channel.channel_id, channel.auto_register)
                  }
                  onUpdateTargetViews={(views) =>
                    updateTargetViews(channel.channel_id, views)
                  }
                  onUnsubscribe={(permanent) =>
                    unsubscribe(channel.channel_id, permanent)
                  }
                  formatNumber={formatNumber}
                  formatTime={formatTime}
                />
              ))}

              {/* 비활성 채널 */}
              {inactiveChannels.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-neutral-500 mb-2">비활성 채널</p>
                  {inactiveChannels.map(channel => (
                    <ChannelCard
                      key={channel.channel_id}
                      channel={channel}
                      isDark={isDark}
                      isEditing={false}
                      onToggleEdit={() => {}}
                      onToggleAutoRegister={() =>
                        toggleAutoRegister(channel.channel_id, channel.auto_register)
                      }
                      onUpdateTargetViews={() => {}}
                      onUnsubscribe={(permanent) =>
                        unsubscribe(channel.channel_id, permanent)
                      }
                      formatNumber={formatNumber}
                      formatTime={formatTime}
                      isInactive
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 채널 카드 컴포넌트
// ============================================

interface ChannelCardProps {
  channel: SubscribedChannel;
  isDark: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onToggleAutoRegister: () => void;
  onUpdateTargetViews: (views: number) => void;
  onUnsubscribe: (permanent: boolean) => void;
  formatNumber: (num: number | undefined) => string;
  formatTime: (dateString: string | undefined) => string;
  isInactive?: boolean;
}

function ChannelCard({
  channel,
  isDark,
  isEditing,
  onToggleEdit,
  onToggleAutoRegister,
  onUpdateTargetViews,
  onUnsubscribe,
  formatNumber,
  formatTime,
  isInactive = false,
}: ChannelCardProps) {
  const [targetViews, setTargetViews] = useState(channel.target_views_default);

  // prop 변경 시 로컬 상태 동기화
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTargetViews(channel.target_views_default);
    });
    return () => cancelAnimationFrame(frame);
  }, [channel.target_views_default]);
  return (
    <div
      className={`rounded-lg p-3 transition-colors ${
        isDark ? 'bg-white/5' : 'bg-black/5'
      } ${isInactive ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* 썸네일 */}
        <div className="shrink-0">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.channel_title}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Rss className="w-5 h-5 text-purple-400" />
            </div>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={`https://youtube.com/channel/${channel.channel_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium text-sm truncate hover:underline ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {channel.channel_title}
            </a>
            <ExternalLink className="w-3 h-3 text-neutral-500 shrink-0" />
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-500 font-mono">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatNumber(channel.subscriber_count)}
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              {formatNumber(channel.video_count)}
            </span>
            {channel.total_videos_registered !== undefined && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" />
                등록 {channel.total_videos_registered}
              </span>
            )}
          </div>

          {/* 상태 */}
          <div className="flex items-center gap-2 mt-2">
            {/* 자동 등록 상태 */}
            <button
              onClick={onToggleAutoRegister}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                channel.auto_register
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-neutral-500/20 text-neutral-400'
              }`}
            >
              {channel.auto_register ? (
                <>
                  <Bell className="w-3 h-3" /> 자동등록
                </>
              ) : (
                <>
                  <BellOff className="w-3 h-3" /> 수동
                </>
              )}
            </button>

            {/* 목표 조회수 */}
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#FFCC00]/20 text-[#FFCC00] rounded">
              <Eye className="w-3 h-3" />
              {channel.target_views_default} views
            </span>

            {/* 마지막 확인 */}
            {channel.last_checked_at && (
              <span className="text-[10px] text-neutral-500">
                {formatTime(channel.last_checked_at)}
              </span>
            )}
          </div>

          {/* 편집 모드 */}
          {isEditing && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <label className="text-[10px] text-neutral-500">기본 목표:</label>
              <input
                type="number"
                value={targetViews}
                onChange={(e) => setTargetViews(parseInt(e.target.value) || 0)}
                className={`w-20 px-2 py-1 text-xs rounded ${
                  isDark
                    ? 'bg-black/30 border-white/10 text-white'
                    : 'bg-white border-black/10 text-black'
                } border focus:border-[#FFCC00] outline-none`}
                min="1"
              />
              <button
                onClick={() => onUpdateTargetViews(targetViews)}
                className="px-2 py-1 text-xs bg-[#FFCC00] text-black rounded hover:bg-yellow-400 transition-colors"
              >
                저장
              </button>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 shrink-0">
          {!isInactive && (
            <button
              onClick={onToggleEdit}
              className={`p-1.5 rounded ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
              } transition-colors`}
              title="설정"
            >
              <Settings className={`w-4 h-4 ${isEditing ? 'text-[#FFCC00]' : ''}`} />
            </button>
          )}
          <button
            onClick={() => onUnsubscribe(false)}
            className={`p-1.5 rounded ${
              isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-100'
            } transition-colors text-red-400 hover:text-red-300`}
            title={isInactive ? '완전 삭제' : '구독 해제'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

