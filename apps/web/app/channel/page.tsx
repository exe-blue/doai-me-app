'use client';

// ============================================
// DoAi.ME - Infra 페이지
// Smart TV 스타일 채널 관리 인터페이스
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Tv, Plus, Settings, Trash2, RefreshCw, Clock, Video, 
  ChevronLeft, ChevronRight, Eye, Calendar, ExternalLink,
  Loader2, AlertCircle, CheckCircle, Rss, TrendingUp
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface SubscribedChannel {
  id: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  autoRegister: boolean;
  subscribedAt: string;
  lastCheckedAt?: string;
  videoCount?: number;
}

interface RecentVideo {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  duration?: string;
  viewCount?: number;
  registeredAt?: string;
  watchedCount?: number;
}

interface ChannelStats {
  totalChannels: number;
  totalVideos: number;
  totalWatched: number;
  todayWatched: number;
}

// ============================================
// Main Page Component
// ============================================

export default function InfraPage() {
  const [isDark] = useState(true);
  const [channels, setChannels] = useState<SubscribedChannel[]>([]);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [stats, setStats] = useState<ChannelStats>({ totalChannels: 0, totalVideos: 0, totalWatched: 0, todayWatched: 0 });
  const [selectedChannel, setSelectedChannel] = useState<SubscribedChannel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 채널 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChannelInput, setNewChannelInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 구독 채널 목록 로드
      const channelRes = await fetch('/api/youtube/subscribe');
      const channelData = await channelRes.json();
      
      if (channelData.success) {
        setChannels(channelData.data || []);
        setStats(prev => ({ ...prev, totalChannels: (channelData.data || []).length }));
      }
      
      // TODO: 최근 영상 로드 (API 구현 필요)
      // 임시 데이터
      setRecentVideos([]);
      
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 채널 추가
  const handleAddChannel = async () => {
    if (!newChannelInput.trim()) return;
    
    setIsAdding(true);
    try {
      // 먼저 채널 정보 조회
      const param = newChannelInput.startsWith('@') 
        ? `handle=${encodeURIComponent(newChannelInput)}`
        : `url=${encodeURIComponent(newChannelInput)}`;
      
      const infoRes = await fetch(`/api/youtube/channel?${param}&includeVideos=false`);
      const infoData = await infoRes.json();
      
      if (!infoData.success) {
        throw new Error(infoData.error || '채널 정보를 불러올 수 없습니다');
      }
      
      const channel = infoData.data.channel;
      
      // 구독 등록
      const subRes = await fetch('/api/youtube/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.channelId,
          channelTitle: channel.title,
          thumbnail: channel.thumbnail,
          uploadsPlaylistId: channel.uploadsPlaylistId,
          autoRegister: true,
        }),
      });
      
      const subData = await subRes.json();
      
      if (subData.success) {
        setNewChannelInput('');
        setShowAddModal(false);
        loadData();
      } else {
        throw new Error(subData.error || '채널 연동에 실패했습니다');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '채널 추가 중 오류가 발생했습니다');
    } finally {
      setIsAdding(false);
    }
  };

  // 채널 삭제
  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('이 채널 연동을 해제하시겠습니까?')) return;
    
    try {
      const res = await fetch(`/api/youtube/subscribe?channelId=${channelId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (data.success) {
        loadData();
        if (selectedChannel?.channelId === channelId) {
          setSelectedChannel(null);
        }
      }
    } catch (err) {
      setError('채널 삭제 중 오류가 발생했습니다');
    }
  };

  // 현재 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
    
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F5F5F5]'}`}>
      {/* 헤더 */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-16 ${isDark ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-md border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
          {/* 로고 & 네비게이션 */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[#FFCC00]">DoAi</span>
              <span className={`text-2xl font-light ${isDark ? 'text-white' : 'text-black'}`}>.Me</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link 
                href="/market" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'text-neutral-400 hover:text-white hover:bg-white/5' : 'text-neutral-600 hover:text-black hover:bg-black/5'}`}
              >
                Market
              </Link>
              <Link 
                href="/infra" 
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#FFCC00]/10 text-[#FFCC00]`}
              >
                Infra
              </Link>
            </nav>
          </div>

          {/* 통계 요약 */}
          <div className="flex items-center gap-6 text-sm font-mono">
            <div className="flex items-center gap-2">
              <Rss className="w-4 h-4 text-[#FFCC00]" />
              <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>채널</span>
              <span className="text-[#FFCC00] font-bold">{stats.totalChannels}</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-green-400" />
              <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>영상</span>
              <span className="text-green-400 font-bold">{stats.totalVideos}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <span className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>시청</span>
              <span className="text-blue-400 font-bold">{stats.totalWatched}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* 페이지 타이틀 */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Tv className="w-8 h-8 text-[#FFCC00]" />
                채널 편성표
              </h1>
              <p className={`mt-2 ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                연동된 YouTube 채널과 영상을 관리합니다
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={isLoading}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                채널 추가
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">×</button>
            </div>
          )}

          {/* 로딩 상태 */}
          {isLoading && channels.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin" />
            </div>
          )}

          {/* 채널 없음 */}
          {!isLoading && channels.length === 0 && (
            <div className={`text-center py-20 ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
              <Tv className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-medium mb-2">연동된 채널이 없습니다</h3>
              <p className="text-sm mb-6">YouTube 채널을 추가하여 영상을 자동으로 등록하세요</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                첫 채널 추가하기
              </button>
            </div>
          )}

          {/* 채널 그리드 (TV 편성표 스타일) */}
          {channels.length > 0 && (
            <div className="grid-tv mb-12">
              {channels.map((channel, index) => (
                <ChannelCard
                  key={channel.channelId}
                  channel={channel}
                  channelNumber={index + 1}
                  isSelected={selectedChannel?.channelId === channel.channelId}
                  isDark={isDark}
                  onSelect={() => setSelectedChannel(channel)}
                  onDelete={() => handleDeleteChannel(channel.channelId)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}

          {/* 선택된 채널 상세 정보 */}
          {selectedChannel && (
            <ChannelDetail
              channel={selectedChannel}
              recentVideos={recentVideos.filter(v => v.channelId === selectedChannel.channelId)}
              isDark={isDark}
              formatTime={formatTime}
              onClose={() => setSelectedChannel(null)}
            />
          )}

          {/* 최근 업로드 영상 로그 */}
          {recentVideos.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FFCC00]" />
                최근 업로드 영상
              </h2>
              
              <div className="grid gap-4">
                {recentVideos.map(video => (
                  <VideoLogItem
                    key={video.videoId}
                    video={video}
                    isDark={isDark}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* 채널 추가 모달 */}
      {showAddModal && (
        <AddChannelModal
          isDark={isDark}
          value={newChannelInput}
          onChange={setNewChannelInput}
          onSubmit={handleAddChannel}
          onClose={() => { setShowAddModal(false); setNewChannelInput(''); }}
          isLoading={isAdding}
        />
      )}
    </div>
  );
}

// ============================================
// 채널 카드 컴포넌트
// ============================================

interface ChannelCardProps {
  channel: SubscribedChannel;
  channelNumber: number;
  isSelected: boolean;
  isDark: boolean;
  onSelect: () => void;
  onDelete: () => void;
  formatTime: (date: string) => string;
}

function ChannelCard({ channel, channelNumber, isSelected, isDark, onSelect, onDelete, formatTime }: ChannelCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`group channel-card cursor-pointer p-4 ${isSelected ? 'ring-2 ring-[#FFCC00] border-[#FFCC00]/50' : ''}`}
    >
      {/* 채널 번호 */}
      <div className="channel-number">
        {String(channelNumber).padStart(2, '0')}
      </div>

      {/* 채널 정보 */}
      <div className="flex items-start gap-4 mt-8">
        {/* 썸네일 */}
        <img
          src={channel.thumbnail}
          alt={channel.channelTitle}
          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
        />
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg truncate">{channel.channelTitle}</h3>
          
          <div className={`flex items-center gap-4 mt-2 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
            {/* 연동 상태 */}
            <span className="flex items-center gap-1">
              {channel.autoRegister ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">자동등록</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-neutral-500" />
                  <span>수동</span>
                </>
              )}
            </span>
            
            {/* 연동 시간 */}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatTime(channel.subscribedAt)}
            </span>
          </div>

          {/* 영상 수 */}
          {channel.videoCount !== undefined && (
            <div className="mt-3 flex items-center gap-1 text-xs">
              <Video className="w-3 h-3 text-[#FFCC00]" />
              <span className="text-[#FFCC00] font-medium">{channel.videoCount}개 영상</span>
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-500/10 text-red-500'}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// 채널 상세 정보 컴포넌트
// ============================================

interface ChannelDetailProps {
  channel: SubscribedChannel;
  recentVideos: RecentVideo[];
  isDark: boolean;
  formatTime: (date: string) => string;
  onClose: () => void;
}

function ChannelDetail({ channel, recentVideos, isDark, formatTime, onClose }: ChannelDetailProps) {
  return (
    <section className={`glass-card p-6 mb-8 animate-fadeIn`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <img
            src={channel.thumbnail}
            alt={channel.channelTitle}
            className="w-20 h-20 rounded-full object-cover border-2 border-[#FFCC00]/50"
          />
          <div>
            <h2 className="text-2xl font-bold">{channel.channelTitle}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
              <span>연동일: {new Date(channel.subscribedAt).toLocaleDateString('ko-KR')}</span>
              {channel.lastCheckedAt && (
                <span>마지막 확인: {formatTime(channel.lastCheckedAt)}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <a
            href={`https://youtube.com/channel/${channel.channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
          >
            ×
          </button>
        </div>
      </div>

      {/* 채널 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="총 영상" value={channel.videoCount || 0} icon={Video} color="text-[#FFCC00]" isDark={isDark} />
        <StatCard label="시청 완료" value={0} icon={Eye} color="text-green-400" isDark={isDark} />
        <StatCard label="대기 중" value={0} icon={Clock} color="text-blue-400" isDark={isDark} />
        <StatCard label="오늘 추가" value={0} icon={TrendingUp} color="text-purple-400" isDark={isDark} />
      </div>

      {/* 최근 영상 */}
      {recentVideos.length > 0 ? (
        <div>
          <h3 className="font-bold mb-4">최근 영상</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recentVideos.slice(0, 4).map(video => (
              <div key={video.videoId} className="video-thumbnail">
                <img src={video.thumbnail} alt={video.title} />
                {video.duration && <span className="time-badge">{video.duration}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center py-8 text-neutral-500">이 채널의 영상 데이터가 없습니다</p>
      )}
    </section>
  );
}

// ============================================
// 통계 카드 컴포넌트
// ============================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isDark: boolean;
}

function StatCard({ label, value, icon: Icon, color, isDark }: StatCardProps) {
  return (
    <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

// ============================================
// 영상 로그 아이템
// ============================================

interface VideoLogItemProps {
  video: RecentVideo;
  isDark: boolean;
  formatTime: (date: string) => string;
}

function VideoLogItem({ video, isDark, formatTime }: VideoLogItemProps) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-black/5'} hover:bg-white/10 transition-colors`}>
      {/* 썸네일 */}
      <div className="video-thumbnail w-40 shrink-0">
        <img src={video.thumbnail} alt={video.title} />
        {video.duration && <span className="time-badge">{video.duration}</span>}
      </div>
      
      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{video.title}</h4>
        <p className="text-sm text-neutral-500 mt-1">{video.channelTitle}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            업로드: {formatTime(video.publishedAt)}
          </span>
          {video.registeredAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              등록: {formatTime(video.registeredAt)}
            </span>
          )}
          {video.viewCount !== undefined && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {video.viewCount.toLocaleString()}회
            </span>
          )}
        </div>
      </div>

      {/* 시청 상태 */}
      <div className="text-right">
        {video.watchedCount !== undefined && video.watchedCount > 0 ? (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{video.watchedCount}회 시청</span>
          </div>
        ) : (
          <span className="text-xs text-neutral-500">대기 중</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// 채널 추가 모달
// ============================================

interface AddChannelModalProps {
  isDark: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isLoading: boolean;
}

function AddChannelModal({ isDark, value, onChange, onSubmit, onClose, isLoading }: AddChannelModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      {/* 모달 */}
      <div className={`relative w-full max-w-md p-6 rounded-2xl ${isDark ? 'bg-neutral-900 border border-white/10' : 'bg-white border border-black/10'} shadow-2xl animate-fadeIn`}>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#FFCC00]" />
          채널 추가
        </h2>
        
        <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          YouTube 채널 URL 또는 @핸들을 입력하세요
        </p>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="@ChannelName 또는 https://youtube.com/..."
          className={`w-full px-4 py-3 rounded-lg border ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-black/10 text-black'} focus:border-[#FFCC00] outline-none transition-colors`}
          disabled={isLoading}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className="px-6 py-2 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                추가 중...
              </>
            ) : (
              '추가'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

