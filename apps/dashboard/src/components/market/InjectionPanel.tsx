

// ============================================
// InjectionPanel - 동영상 등록 패널
// YouTube Data API를 통한 자동 정보 조회 지원
// Kernel 브라우저 자동화 통합 (확률적 실행)
// ============================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Video, Zap, AlertCircle, Loader2, CheckCircle, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNodes } from '@/contexts/NodeContext';

interface InjectionPanelProps {
  isDark: boolean;
}

// YouTube 영상 정보 타입
interface VideoInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  thumbnail: string;
  duration: number | null;
  viewCount: number | null;
}

// Kernel 확률 설정 (고정값, 사용자 조정 불가)
const KERNEL_PROBABILITIES = {
  like: { min: 0.05, max: 0.10 },      // 5-10% 확률
  comment: { min: 0.05, max: 0.10 },   // 5-10% 확률
  subscribe: { min: 0.05, max: 0.10 }, // 5-10% 확률
};

// 확률 계산 함수
function shouldExecuteAction(actionType: keyof typeof KERNEL_PROBABILITIES): boolean {
  const { min, max } = KERNEL_PROBABILITIES[actionType];
  const threshold = min + Math.random() * (max - min);
  return Math.random() < threshold;
}

// 랜덤 댓글 목록
const RANDOM_COMMENTS = [
  '좋은 영상이네요!',
  '항상 잘 보고 있습니다 👍',
  '유익한 정보 감사합니다',
  '영상 퀄리티가 정말 좋네요',
  '오늘도 좋은 영상 감사해요~',
  '구독하고 갑니다!',
  '계속 좋은 영상 부탁드려요',
  '잘 보고 갑니다~',
];

function getRandomComment(): string {
  return RANDOM_COMMENTS[Math.floor(Math.random() * RANDOM_COMMENTS.length)];
}

export function InjectionPanel({ isDark }: InjectionPanelProps) {
  // 영상 폼 상태
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetchingVideo, setIsFetchingVideo] = useState(false);
  const [targetViews, setTargetViews] = useState('400');
  
  // Kernel 자동화 상태
  const [kernelEnabled, setKernelEnabled] = useState(false);
  const [kernelConfigured, setKernelConfigured] = useState<boolean | null>(null);
  const [isKernelRunning, setIsKernelRunning] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { addVideo, addLog } = useNodes();
  
  // 디바운스용 타이머 ref
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 마운트 시 Kernel 상태 확인
  useEffect(() => {
    fetch('/api/kernel/youtube')
      .then(res => res.json())
      .then(data => {
        setKernelConfigured(data.kernelConfigured || false);
      })
      .catch(() => {
        setKernelConfigured(false);
      });
  }, []);

  // ============================================
  // YouTube URL에서 영상 정보 자동 조회
  // ============================================
  const fetchVideoInfo = useCallback(async (url: string) => {
    if (!url.trim()) {
      setVideoInfo(null);
      return;
    }
    
    // URL 패턴 확인
    const youtubePatterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
    ];
    
    const isYoutubeUrl = youtubePatterns.some(pattern => pattern.test(url));
    if (!isYoutubeUrl) {
      setVideoInfo(null);
      return;
    }
    
    setIsFetchingVideo(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/youtube/video?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (data.success) {
        setVideoInfo(data.data);
        addLog('info', `📺 영상 정보 로드: ${data.data.title}`);
      } else {
        setError(data.error || '영상 정보를 불러올 수 없습니다');
        setVideoInfo(null);
      }
    } catch {
      setError('영상 정보 조회 중 오류가 발생했습니다');
      setVideoInfo(null);
    } finally {
      setIsFetchingVideo(false);
    }
  }, [addLog]);

  // URL 변경 시 디바운스 적용하여 자동 조회
  useEffect(() => {
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }
    
    if (videoUrl.trim()) {
      fetchTimerRef.current = setTimeout(() => {
        fetchVideoInfo(videoUrl);
      }, 500); // 500ms 디바운스
    } else {
      setVideoInfo(null);
    }
    
    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
  }, [videoUrl, fetchVideoInfo]);

  // ============================================
  // Kernel 자동화 실행 (확률적)
  // ============================================
  const executeKernelAutomation = useCallback(async (video: VideoInfo) => {
    if (!kernelEnabled || !kernelConfigured) return;
    
    setIsKernelRunning(true);
    addLog('info', `🌐 Kernel 자동화 시작: "${video.title}"`);

    // 확률적으로 실행할 액션 결정
    const willLike = shouldExecuteAction('like');
    const willComment = shouldExecuteAction('comment');
    const willSubscribe = shouldExecuteAction('subscribe');
    
    // 실행할 액션 로그
    const plannedActions = [];
    if (willLike) plannedActions.push('좋아요');
    if (willComment) plannedActions.push('댓글');
    if (willSubscribe) plannedActions.push('구독');
    
    if (plannedActions.length === 0) {
      addLog('info', `🎲 Kernel: 이번에는 추가 액션 없음 (확률 미당첨)`);
      setIsKernelRunning(false);
      return;
    }
    
    addLog('info', `🎲 Kernel 확률 당첨: ${plannedActions.join(', ')}`);
    
    try {
      // 좋아요 실행
      if (willLike) {
        addLog('info', `👍 Kernel: 좋아요 실행 중...`);
        const likeRes = await fetch('/api/kernel/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'like', videoId: video.videoId }),
        });
        const likeData = await likeRes.json();
        
        if (likeData.success) {
          addLog('success', `✅ Kernel 좋아요 완료 (${(likeData.totalDuration / 1000).toFixed(1)}초)`);
        } else {
          addLog('error', `❌ Kernel 좋아요 실패: ${likeData.error || likeData.data?.error || '알 수 없는 오류'}`);
        }
      }
      
      // 댓글 실행
      if (willComment) {
        const comment = getRandomComment();
        addLog('info', `💬 Kernel: 댓글 작성 중 - "${comment}"`);
        const commentRes = await fetch('/api/kernel/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'comment', videoId: video.videoId, comment }),
        });
        const commentData = await commentRes.json();
        
        if (commentData.success) {
          addLog('success', `✅ Kernel 댓글 완료 (${(commentData.totalDuration / 1000).toFixed(1)}초)`);
        } else {
          addLog('error', `❌ Kernel 댓글 실패: ${commentData.error || commentData.data?.error || '알 수 없는 오류'}`);
        }
      }
      
      // 구독 실행
      if (willSubscribe && video.channelId) {
        addLog('info', `🔔 Kernel: 채널 구독 중...`);
        const subRes = await fetch('/api/kernel/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'subscribe', channelId: video.channelId }),
        });
        const subData = await subRes.json();
        
        if (subData.success) {
          addLog('success', `✅ Kernel 구독 완료 (${(subData.totalDuration / 1000).toFixed(1)}초)`);
        } else {
          addLog('error', `❌ Kernel 구독 실패: ${subData.error || subData.data?.error || '알 수 없는 오류'}`);
        }
      }
      
      addLog('success', `🌐 Kernel 자동화 완료`);
    } catch (err) {
      addLog('error', `❌ Kernel 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsKernelRunning(false);
    }
  }, [kernelEnabled, kernelConfigured, addLog]);

  // ============================================
  // 영상 등록
  // ============================================
  const handleVideoSubmit = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    
    const title = videoInfo?.title || '';
    if (!title) {
      setError('유효한 YouTube URL을 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      addVideo({
        title: title,
        url: videoUrl.trim(),
        targetViews: parseInt(targetViews) || 400,
        thumbnail: videoInfo?.thumbnail,
        channel: videoInfo?.channelTitle,
        videoId: videoInfo?.videoId || '',
      });

      setSuccessMessage(`"${title}" 등록 완료!`);
      addLog('success', `✅ 영상 "${title}" 등록 완료`);
      
      // Kernel 자동화 실행 (확률적)
      if (kernelEnabled && videoInfo) {
        // 비동기로 실행 (등록 완료 후 백그라운드에서)
        executeKernelAutomation(videoInfo);
      }
      
      // 폼 초기화
      setVideoUrl('');
      setVideoInfo(null);
      setTargetViews('400');
      
      // 3초 후 성공 메시지 제거
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('영상 등록 중 오류가 발생했습니다');
      addLog('error', `❌ 영상 등록 실패: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [videoInfo, videoUrl, targetViews, addVideo, addLog, kernelEnabled, executeKernelAutomation]);

  // 시간 포맷팅
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-xl overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FFCC00]/20 rounded-lg">
            <Video className="w-5 h-5 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>동영상 등록</h3>
            <p className="text-xs text-neutral-500">YouTube URL 입력 시 자동으로 정보를 불러옵니다</p>
          </div>
        </div>
        
        {/* Infra 링크 */}
        <Link
          to="/infra"
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${isDark ? 'bg-white/10 text-neutral-400 hover:text-white hover:bg-white/20' : 'bg-black/5 text-neutral-600 hover:bg-black/10'}`}
        >
          채널 관리 →
        </Link>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* 폼 */}
      <div className="p-6 space-y-4">
        {/* URL 입력 */}
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[300px] space-y-1">
            <label className="block font-mono text-[10px] text-[#FFCC00] uppercase tracking-wider">
              YouTube URL <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className={`w-full ${isDark ? 'bg-black/30 border-white/10 text-white placeholder:text-neutral-600' : 'bg-white border-black/10 text-black placeholder:text-neutral-400'} border rounded-lg px-4 py-3 text-sm focus:border-[#FFCC00] focus:ring-1 focus:ring-[#FFCC00]/30 outline-none transition-all pr-10`}
                placeholder="https://youtube.com/watch?v=... 또는 https://youtu.be/..."
                aria-label="YouTube URL"
                disabled={isSubmitting || isKernelRunning}
              />
              {isFetchingVideo && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFCC00] animate-spin" />
              )}
              {videoInfo && !isFetchingVideo && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
              )}
            </div>
          </div>

          {/* 목표 조회수 */}
          <div className="w-32 space-y-1">
            <label className="block font-mono text-[10px] text-neutral-500 uppercase tracking-wider">Target Views</label>
            <input
              type="number"
              value={targetViews}
              onChange={(e) => setTargetViews(e.target.value)}
              className={`w-full ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-black/10 text-black'} border rounded-lg px-4 py-3 text-sm focus:border-[#FFCC00] focus:ring-1 focus:ring-[#FFCC00]/30 outline-none transition-all`}
              placeholder="400"
              aria-label="목표 조회수"
              disabled={isSubmitting || isKernelRunning}
              min="1"
            />
          </div>

          {/* 등록 버튼 */}
          <button
            onClick={handleVideoSubmit}
            disabled={isSubmitting || isKernelRunning || !videoInfo}
            className={`px-6 py-3 bg-[#FFCC00] text-black font-bold rounded-lg hover:bg-yellow-400 transition-all flex items-center gap-2 shadow-lg shadow-[#FFCC00]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
          >
            <Zap className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            {isSubmitting ? '등록 중...' : isKernelRunning ? 'Kernel 실행 중...' : '등록'}
          </button>
        </div>

        {/* 영상 미리보기 */}
        {videoInfo && (
          <div className={`flex gap-4 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'} animate-fadeIn`}>
            {/* 썸네일 */}
            <div className="relative w-44 aspect-video rounded-lg overflow-hidden shrink-0 bg-neutral-800">
              <img 
                src={videoInfo.thumbnail} 
                alt={videoInfo.title}
                className="w-full h-full object-cover"
              />
              {videoInfo.duration && (
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-mono rounded">
                  {formatDuration(videoInfo.duration)}
                </span>
              )}
            </div>
            
            {/* 정보 */}
            <div className="flex-1 min-w-0 py-1">
              <h4 className={`font-medium text-sm mb-1.5 line-clamp-2 ${isDark ? 'text-white' : 'text-black'}`}>
                {videoInfo.title}
              </h4>
              <p className="text-xs text-neutral-500 mb-3">{videoInfo.channelTitle}</p>
              <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-mono">
                {videoInfo.viewCount !== null && (
                  <span>조회수: {videoInfo.viewCount.toLocaleString()}</span>
                )}
                <a 
                  href={videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#FFCC00] hover:underline flex items-center gap-1"
                >
                  YouTube <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ============================================
            Kernel 자동화 설정
            ============================================ */}
        <div className={`p-4 rounded-xl border-2 border-dashed transition-all ${
          kernelEnabled 
            ? 'border-cyan-500/50 bg-cyan-500/5' 
            : isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kernelEnabled ? 'bg-cyan-500/20' : isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <Globe className={`w-5 h-5 ${kernelEnabled ? 'text-cyan-400' : 'text-neutral-500'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-black'}`}>
                    Kernel 웹 자동화
                  </span>
                  {kernelEnabled && (
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-mono rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      확률 실행
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {kernelConfigured === false 
                    ? '⚠️ KERNEL_API_KEY 미설정'
                    : '좋아요, 댓글, 구독을 5~10% 확률로 자동 실행'}
                </p>
              </div>
            </div>
            
            {/* 토글 스위치 */}
            <button
              onClick={() => setKernelEnabled(!kernelEnabled)}
              disabled={kernelConfigured === false}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                kernelEnabled 
                  ? 'bg-cyan-500' 
                  : isDark ? 'bg-white/20' : 'bg-black/20'
              } ${kernelConfigured === false ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${
                kernelEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Kernel 활성화 시 상세 정보 표시 */}
          {kernelEnabled && kernelConfigured && (
            <div className="mt-4 pt-4 border-t border-cyan-500/20">
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-black/30' : 'bg-white'}`}>
                  <div className="text-[10px] text-neutral-500 mb-1">👍 좋아요</div>
                  <div className="text-sm font-mono text-cyan-400">5~10%</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-black/30' : 'bg-white'}`}>
                  <div className="text-[10px] text-neutral-500 mb-1">💬 댓글</div>
                  <div className="text-sm font-mono text-cyan-400">5~10%</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-black/30' : 'bg-white'}`}>
                  <div className="text-[10px] text-neutral-500 mb-1">🔔 구독</div>
                  <div className="text-sm font-mono text-cyan-400">5~10%</div>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 mt-3 text-center">
                ※ 확률은 자연스러운 트래픽을 위해 고정되어 있으며 조정할 수 없습니다
              </p>
            </div>
          )}

          {/* Kernel 실행 중 표시 */}
          {isKernelRunning && (
            <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-cyan-500/10 rounded-lg">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-sm text-cyan-400">Kernel 자동화 실행 중... (로그 패널 확인)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
