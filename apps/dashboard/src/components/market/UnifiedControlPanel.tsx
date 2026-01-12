

/**
 * UnifiedControlPanel - 통합 제어 패널
 * 
 * Laixi 로컬 제어 + Kernel 웹 자동화를 통합한 제어 패널입니다.
 * 
 * 실행 모드:
 * - Laixi Only: 로컬 PC → Laixi → Android 기기 (대량 병렬)
 * - Kernel Only: 서버 → Kernel BaaS → 브라우저 (단일 세션)
 * - Hybrid: Laixi로 시청 + Kernel로 인터랙션
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Smartphone,
  Globe,
  Zap,
  AlertCircle,
  CheckCircle,
  Loader2,
  ThumbsUp,
  MessageSquare,
  Bell,
  Eye,
  Layers
} from 'lucide-react';

// ============================================
// Types
// ============================================

type ExecutionMode = 'laixi' | 'kernel' | 'hybrid';

interface ExecutionConfig {
  mode: ExecutionMode;
  batchSizePercent: number;
  batchIntervalSeconds: number;
  watchDurationMin: number;
  watchDurationMax: number;
  likeProbability: number;
  commentProbability: number;
  subscribeProbability: number;
}

interface UnifiedControlPanelProps {
  isDark: boolean;
  videoUrl?: string;
  videoTitle?: string;
  videoId?: string;
  channelId?: string;
  onExecutionStart?: () => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
}

interface ExecutionResult {
  success: boolean;
  mode: ExecutionMode;
  deviceCount?: number;
  successCount?: number;
  failedCount?: number;
  totalWatchTime?: number;
  kernelActions?: {
    liked: boolean;
    commented: boolean;
    subscribed: boolean;
  };
  error?: string;
}

// ============================================
// Default Config
// ============================================

const defaultConfig: ExecutionConfig = {
  mode: 'laixi',
  batchSizePercent: 50,
  batchIntervalSeconds: 60,
  watchDurationMin: 30,
  watchDurationMax: 120,
  likeProbability: 0.05,
  commentProbability: 0.02,
  subscribeProbability: 0.01
};

// ============================================
// Component
// ============================================

export function UnifiedControlPanel({
  isDark,
  videoUrl,
  videoTitle,
  videoId,
  channelId,
  onExecutionStart,
  onExecutionComplete
}: UnifiedControlPanelProps) {
  // 상태
  const [config, setConfig] = useState<ExecutionConfig>(defaultConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Laixi/Kernel 상태
  const [laixiConnected, setLaixiConnected] = useState(false);
  const [kernelConfigured, setKernelConfigured] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);

  // 초기 상태 확인
  useEffect(() => {
    checkLaixiStatus();
    checkKernelStatus();
  }, []);

  const checkLaixiStatus = async () => {
    try {
      const res = await fetch('/api/laixi?action=health');
      const data = await res.json();
      setLaixiConnected(data.success && data.status === 'connected');
      setDeviceCount(data.device_count || 0);
    } catch {
      setLaixiConnected(false);
    }
  };

  const checkKernelStatus = async () => {
    try {
      const res = await fetch('/api/kernel/youtube');
      const data = await res.json();
      setKernelConfigured(data.kernelConfigured || false);
    } catch {
      setKernelConfigured(false);
    }
  };

  // 실행
  const executeWorkload = useCallback(async () => {
    if (!videoUrl) {
      setError('영상 URL이 필요합니다');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setExecutionStatus('실행 준비 중...');
    
    if (onExecutionStart) {
      onExecutionStart();
    }

    try {
      const result: ExecutionResult = {
        success: false,
        mode: config.mode
      };

      switch (config.mode) {
        case 'laixi': {
          // Laixi Only: 로컬 디바이스에서 시청
          setExecutionStatus('Laixi 시청 명령 전송 중...');

          const laixiRes = await fetch('/api/laixi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_url: videoUrl,
              video_id: videoId,
              title: videoTitle,
              watch_duration_seconds: Math.floor(
                Math.random() * (config.watchDurationMax - config.watchDurationMin) + config.watchDurationMin
              ),
              batch_config: {
                batch_size_percent: config.batchSizePercent,
                batch_interval_seconds: config.batchIntervalSeconds
              }
            })
          });

          const laixiData = await laixiRes.json();

          if (laixiData.success) {
            result.success = true;
            result.deviceCount = laixiData.dispatched_count || 0;
            setExecutionStatus(`${result.deviceCount}대 디바이스에 시청 명령 전송 완료`);
          } else {
            throw new Error(laixiData.error || 'Laixi 실행 실패');
          }
          break;
        }

        case 'kernel': {
          // Kernel Only: 브라우저 자동화
          setExecutionStatus('Kernel 브라우저 자동화 실행 중...');
          
          const kernelActions = {
            liked: false,
            commented: false,
            subscribed: false
          };

          // Watch (필수)
          const watchRes = await fetch('/api/kernel/youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'watch', videoId })
          });
          const watchData = await watchRes.json();
          
          if (!watchData.success) {
            throw new Error(watchData.error || 'Kernel 시청 실패');
          }

          // Like (확률적)
          if (Math.random() < config.likeProbability) {
            setExecutionStatus('Kernel 좋아요 실행 중...');
            const likeRes = await fetch('/api/kernel/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', videoId })
            });
            const likeData = await likeRes.json();
            kernelActions.liked = likeData.success;
          }

          // Comment (확률적)
          if (Math.random() < config.commentProbability) {
            setExecutionStatus('Kernel 댓글 작성 중...');
            const comments = [
              '좋은 영상이네요!',
              '잘 봤습니다 👍',
              '유익한 정보 감사합니다',
              '구독하고 갑니다!'
            ];
            const commentRes = await fetch('/api/kernel/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'comment', 
                videoId,
                comment: comments[Math.floor(Math.random() * comments.length)]
              })
            });
            const commentData = await commentRes.json();
            kernelActions.commented = commentData.success;
          }

          // Subscribe (확률적)
          if (channelId && Math.random() < config.subscribeProbability) {
            setExecutionStatus('Kernel 구독 실행 중...');
            const subRes = await fetch('/api/kernel/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'subscribe', channelId })
            });
            const subData = await subRes.json();
            kernelActions.subscribed = subData.success;
          }

          result.success = true;
          result.kernelActions = kernelActions;
          setExecutionStatus('Kernel 자동화 완료');
          break;
        }

        case 'hybrid': {
          // Hybrid: Laixi 시청 + Kernel 인터랙션
          setExecutionStatus('Hybrid 모드: Laixi 시청 시작...');

          // 1. Laixi로 시청
          const hybridLaixiRes = await fetch('/api/laixi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              video_url: videoUrl,
              video_id: videoId,
              title: videoTitle,
              watch_duration_seconds: Math.floor(
                Math.random() * (config.watchDurationMax - config.watchDurationMin) + config.watchDurationMin
              ),
              batch_config: {
                batch_size_percent: config.batchSizePercent,
                batch_interval_seconds: config.batchIntervalSeconds
              }
            })
          });
          
          const hybridLaixiData = await hybridLaixiRes.json();
          result.deviceCount = hybridLaixiData.dispatched_count || 0;

          // 2. Kernel로 인터랙션
          setExecutionStatus('Hybrid 모드: Kernel 인터랙션 실행...');
          
          const hybridKernelActions = {
            liked: false,
            commented: false,
            subscribed: false
          };

          // Like
          if (Math.random() < config.likeProbability) {
            const likeRes = await fetch('/api/kernel/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'like', videoId })
            });
            hybridKernelActions.liked = (await likeRes.json()).success;
          }

          // Subscribe
          if (channelId && Math.random() < config.subscribeProbability) {
            const subRes = await fetch('/api/kernel/youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'subscribe', channelId })
            });
            hybridKernelActions.subscribed = (await subRes.json()).success;
          }

          result.success = true;
          result.kernelActions = hybridKernelActions;
          setExecutionStatus('Hybrid 모드 완료');
          break;
        }
      }

      setLastResult(result);
      
      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMsg);
      setLastResult({
        success: false,
        mode: config.mode,
        error: errorMsg
      });
    } finally {
      setIsExecuting(false);
      setTimeout(() => setExecutionStatus(null), 3000);
    }
  }, [config, videoUrl, videoId, videoTitle, channelId, onExecutionStart, onExecutionComplete]);

  // 모드 아이콘
  const ModeIcon = ({ mode }: { mode: ExecutionMode }) => {
    switch (mode) {
      case 'laixi':
        return <Smartphone className="w-4 h-4" />;
      case 'kernel':
        return <Globe className="w-4 h-4" />;
      case 'hybrid':
        return <Layers className="w-4 h-4" />;
    }
  };

  // 모드 설명
  const getModeDescription = (mode: ExecutionMode) => {
    switch (mode) {
      case 'laixi':
        return '로컬 Android 기기에서 대량 시청';
      case 'kernel':
        return '클라우드 브라우저에서 인터랙션';
      case 'hybrid':
        return 'Laixi 시청 + Kernel 인터랙션';
    }
  };

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-xl overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              통합 제어
            </h3>
            <p className="text-xs text-neutral-500">
              Laixi + Kernel 멀티 모드 실행
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 연결 상태 표시 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20">
            <div className={`w-2 h-2 rounded-full ${laixiConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-neutral-400">Laixi</span>
            <div className={`w-2 h-2 rounded-full ${kernelConfigured ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-neutral-400">Kernel</span>
          </div>

          {/* 설정 버튼 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings 
                ? 'bg-purple-500/20 text-purple-400' 
                : isDark ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-600'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 모드 선택 */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-2 block">
          실행 모드
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['laixi', 'kernel', 'hybrid'] as ExecutionMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setConfig({ ...config, mode })}
              disabled={
                (mode === 'laixi' && !laixiConnected) ||
                (mode === 'kernel' && !kernelConfigured) ||
                (mode === 'hybrid' && (!laixiConnected || !kernelConfigured))
              }
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                config.mode === mode
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : isDark 
                    ? 'border-white/10 hover:border-white/20 bg-black/20' 
                    : 'border-black/10 hover:border-black/20 bg-gray-50'
              } ${
                ((mode === 'laixi' && !laixiConnected) ||
                (mode === 'kernel' && !kernelConfigured) ||
                (mode === 'hybrid' && (!laixiConnected || !kernelConfigured)))
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
            >
              <ModeIcon mode={mode} />
              <span className={`text-sm font-medium ${
                config.mode === mode ? 'text-cyan-400' : isDark ? 'text-white' : 'text-black'
              }`}>
                {mode === 'laixi' ? 'Laixi' : mode === 'kernel' ? 'Kernel' : 'Hybrid'}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">
          {getModeDescription(config.mode)}
        </p>
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'} space-y-4`}>
          {/* 배치 설정 (Laixi 모드) */}
          {(config.mode === 'laixi' || config.mode === 'hybrid') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                  배치 크기 (%)
                </label>
                <input
                  type="number"
                  value={config.batchSizePercent}
                  onChange={(e) => setConfig({ ...config, batchSizePercent: parseInt(e.target.value) || 50 })}
                  min={10}
                  max={100}
                  className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                    isDark 
                      ? 'bg-black/30 border-white/10 text-white' 
                      : 'bg-white border-black/10 text-black'
                  } border focus:border-cyan-500 outline-none`}
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                  배치 간격 (초)
                </label>
                <input
                  type="number"
                  value={config.batchIntervalSeconds}
                  onChange={(e) => setConfig({ ...config, batchIntervalSeconds: parseInt(e.target.value) || 60 })}
                  min={10}
                  max={300}
                  className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                    isDark 
                      ? 'bg-black/30 border-white/10 text-white' 
                      : 'bg-white border-black/10 text-black'
                  } border focus:border-cyan-500 outline-none`}
                />
              </div>
            </div>
          )}

          {/* 시청 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                최소 시청 (초)
              </label>
              <input
                type="number"
                value={config.watchDurationMin}
                onChange={(e) => setConfig({ ...config, watchDurationMin: parseInt(e.target.value) || 30 })}
                min={10}
                max={300}
                className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                  isDark 
                    ? 'bg-black/30 border-white/10 text-white' 
                    : 'bg-white border-black/10 text-black'
                } border focus:border-cyan-500 outline-none`}
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                최대 시청 (초)
              </label>
              <input
                type="number"
                value={config.watchDurationMax}
                onChange={(e) => setConfig({ ...config, watchDurationMax: parseInt(e.target.value) || 120 })}
                min={30}
                max={600}
                className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                  isDark 
                    ? 'bg-black/30 border-white/10 text-white' 
                    : 'bg-white border-black/10 text-black'
                } border focus:border-cyan-500 outline-none`}
              />
            </div>
          </div>

          {/* 인터랙션 확률 (Kernel 모드) */}
          {(config.mode === 'kernel' || config.mode === 'hybrid') && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" /> 좋아요
                </label>
                <input
                  type="number"
                  value={(config.likeProbability * 100).toFixed(0)}
                  onChange={(e) => setConfig({ ...config, likeProbability: (parseInt(e.target.value) || 5) / 100 })}
                  min={0}
                  max={100}
                  className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                    isDark 
                      ? 'bg-black/30 border-white/10 text-white' 
                      : 'bg-white border-black/10 text-black'
                  } border focus:border-cyan-500 outline-none`}
                />
                <span className="text-[10px] text-neutral-500">%</span>
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> 댓글
                </label>
                <input
                  type="number"
                  value={(config.commentProbability * 100).toFixed(0)}
                  onChange={(e) => setConfig({ ...config, commentProbability: (parseInt(e.target.value) || 2) / 100 })}
                  min={0}
                  max={100}
                  className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                    isDark 
                      ? 'bg-black/30 border-white/10 text-white' 
                      : 'bg-white border-black/10 text-black'
                  } border focus:border-cyan-500 outline-none`}
                />
                <span className="text-[10px] text-neutral-500">%</span>
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Bell className="w-3 h-3" /> 구독
                </label>
                <input
                  type="number"
                  value={(config.subscribeProbability * 100).toFixed(0)}
                  onChange={(e) => setConfig({ ...config, subscribeProbability: (parseInt(e.target.value) || 1) / 100 })}
                  min={0}
                  max={100}
                  className={`w-full mt-1 px-3 py-2 rounded-lg text-sm ${
                    isDark 
                      ? 'bg-black/30 border-white/10 text-white' 
                      : 'bg-white border-black/10 text-black'
                  } border focus:border-cyan-500 outline-none`}
                />
                <span className="text-[10px] text-neutral-500">%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 메시지 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {executionStatus && (
        <div className="mx-6 mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center gap-2 text-cyan-400 text-sm">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          {executionStatus}
        </div>
      )}

      {lastResult && lastResult.success && !executionStatus && (
        <div className="mx-6 mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {lastResult.mode === 'laixi' && `${lastResult.deviceCount}대 디바이스 실행 완료`}
          {lastResult.mode === 'kernel' && 'Kernel 자동화 완료'}
          {lastResult.mode === 'hybrid' && `Hybrid 완료: ${lastResult.deviceCount}대 + Kernel`}
        </div>
      )}

      {/* 실행 버튼 */}
      <div className="p-6">
        <button
          onClick={executeWorkload}
          disabled={isExecuting || !videoUrl || (config.mode === 'laixi' && !laixiConnected) || (config.mode === 'kernel' && !kernelConfigured)}
          className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-bold text-lg transition-all ${
            isExecuting
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400 shadow-lg shadow-cyan-500/20'
          }`}
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              실행 중...
            </>
          ) : (
            <>
              <ModeIcon mode={config.mode} />
              {config.mode === 'laixi' && `Laixi 시청 (${deviceCount}대)`}
              {config.mode === 'kernel' && 'Kernel 자동화'}
              {config.mode === 'hybrid' && 'Hybrid 실행'}
            </>
          )}
        </button>

        {/* 모드별 상세 정보 */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-neutral-500">
          {config.mode === 'laixi' && (
            <>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {config.watchDurationMin}-{config.watchDurationMax}초 시청
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {config.batchSizePercent}% 배치
              </span>
            </>
          )}
          {config.mode === 'kernel' && (
            <>
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                {(config.likeProbability * 100).toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {(config.commentProbability * 100).toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <Bell className="w-3 h-3" />
                {(config.subscribeProbability * 100).toFixed(0)}%
              </span>
            </>
          )}
          {config.mode === 'hybrid' && (
            <span>Laixi 시청 + Kernel 인터랙션</span>
          )}
        </div>
      </div>
    </div>
  );
}
