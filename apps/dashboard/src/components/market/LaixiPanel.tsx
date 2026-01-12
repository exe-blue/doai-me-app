

/**
 * LaixiPanel - Laixi 로컬 디바이스 제어 패널
 * 
 * 로컬 PC에 설치된 Laixi를 통해 Android 기기에서
 * YouTube 영상을 직접 시청하도록 명령합니다.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  WifiOff,
  Monitor
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface LaixiDevice {
  id: string;
  model?: string;
  status: string;
}

interface LaixiHealthResponse {
  success: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'unavailable';
  device_count?: number;
  laixi_url?: string;
  message?: string;
}

interface LaixiPanelProps {
  isDark: boolean;
}

// ============================================
// Component
// ============================================

export function LaixiPanel({ isDark }: LaixiPanelProps) {
  // 상태
  const [health, setHealth] = useState<LaixiHealthResponse | null>(null);
  const [devices, setDevices] = useState<LaixiDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [watchDuration, setWatchDuration] = useState('30');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ============================================
  // API Calls
  // ============================================

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/laixi?action=health');
      const data = await res.json();
      setHealth(data);
      return data;
    } catch {
      setHealth({
        success: false,
        status: 'error',
        message: 'API 요청 실패'
      });
      return null;
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/laixi?action=devices');
      const data = await res.json();
      
      if (data.success && data.devices) {
        setDevices(data.devices);
      } else {
        setDevices([]);
      }
    } catch {
      setDevices([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const healthData = await checkHealth();
    
    if (healthData?.success) {
      await fetchDevices();
    }
    
    setIsLoading(false);
  }, [checkHealth, fetchDevices]);

  // 초기 로드
  useEffect(() => {
    refreshAll();
    
    // 30초마다 상태 갱신
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ============================================
  // Actions
  // ============================================

  const handleWatch = async () => {
    if (!videoUrl.trim()) {
      setError('YouTube URL을 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/laixi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          target_device_ids: selectedDevices.length > 0 ? selectedDevices : null,
          watch_duration_seconds: parseInt(watchDuration) || 30,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(`✅ ${data.dispatched_count}대 디바이스에 시청 명령 전송`);
        setIsWatching(true);
        setVideoUrl('');
        
        // 3초 후 메시지 제거
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || '시청 명령 실패');
      }
    } catch {
      setError('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/laixi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_device_ids: selectedDevices.length > 0 ? selectedDevices : null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage('⏹️ YouTube 종료 완료');
        setIsWatching(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || '중지 명령 실패');
      }
    } catch {
      setError('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllDevices = () => {
    if (selectedDevices.length === devices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(devices.map(d => d.id));
    }
  };

  // ============================================
  // Render
  // ============================================

  const isConnected = health?.success && health?.status === 'connected';
  const deviceCount = devices.length;

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-xl overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-black/10'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isConnected ? (
              <Monitor className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                Laixi 로컬 제어
              </h3>
              {isConnected && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-mono rounded-full">
                  {deviceCount}대 연결
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              {isConnected 
                ? '로컬 PC → Android 기기 직접 제어' 
                : 'Laixi 서버 연결 필요 (touping.exe)'}
            </p>
          </div>
        </div>
        
        {/* 새로고침 버튼 */}
        <button
          onClick={refreshAll}
          disabled={isLoading}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''} ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`} />
        </button>
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

      {/* 메인 컨텐츠 */}
      <div className="p-6 space-y-4">
        {/* 연결 안됨 상태 */}
        {!isConnected && (
          <div className={`p-4 rounded-xl ${isDark ? 'bg-red-500/10' : 'bg-red-50'} text-center`}>
            <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              Laixi 서버에 연결되지 않음
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              로컬 PC에서 touping.exe를 실행해주세요
            </p>
          </div>
        )}

        {/* 연결됨 상태 */}
        {isConnected && (
          <>
            {/* 디바이스 목록 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                  대상 디바이스
                </label>
                <button
                  onClick={selectAllDevices}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  {selectedDevices.length === devices.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              
              <div className={`p-3 rounded-lg ${isDark ? 'bg-black/30' : 'bg-gray-100'} max-h-40 overflow-y-auto`}>
                {devices.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-2">
                    연결된 기기가 없습니다
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {devices.map(device => (
                      <button
                        key={device.id}
                        onClick={() => toggleDeviceSelection(device.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                          selectedDevices.includes(device.id)
                            ? 'bg-cyan-500/20 border border-cyan-500/50'
                            : isDark 
                              ? 'bg-white/5 border border-white/10 hover:border-white/20'
                              : 'bg-white border border-black/10 hover:border-black/20'
                        }`}
                      >
                        <Smartphone className={`w-4 h-4 ${
                          selectedDevices.includes(device.id) 
                            ? 'text-cyan-400' 
                            : 'text-neutral-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-mono truncate ${isDark ? 'text-white' : 'text-black'}`}>
                            {device.id.slice(0, 8)}...
                          </p>
                          {device.model && (
                            <p className="text-[10px] text-neutral-500 truncate">
                              {device.model}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <p className="text-[10px] text-neutral-500">
                {selectedDevices.length === 0 
                  ? `선택 안함 = 전체 ${devices.length}대에 명령`
                  : `${selectedDevices.length}대 선택됨`}
              </p>
            </div>

            {/* URL 입력 */}
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-cyan-400 uppercase tracking-wider">
                YouTube URL
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                disabled={isLoading}
                className={`w-full px-4 py-3 rounded-lg text-sm outline-none transition-all ${
                  isDark 
                    ? 'bg-black/30 border border-white/10 text-white placeholder:text-neutral-600 focus:border-cyan-500'
                    : 'bg-white border border-black/10 text-black placeholder:text-neutral-400 focus:border-cyan-500'
                }`}
              />
            </div>

            {/* 시청 시간 */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                  시청 시간 (초)
                </label>
                <input
                  type="number"
                  value={watchDuration}
                  onChange={(e) => setWatchDuration(e.target.value)}
                  min="5"
                  max="3600"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-lg text-sm outline-none transition-all ${
                    isDark 
                      ? 'bg-black/30 border border-white/10 text-white focus:border-cyan-500'
                      : 'bg-white border border-black/10 text-black focus:border-cyan-500'
                  }`}
                />
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleWatch}
                disabled={isLoading || !videoUrl.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                시청 시작
              </button>
              
              <button
                onClick={handleStop}
                disabled={isLoading}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-50 ${
                  isDark
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                <Square className="w-4 h-4" />
                중지
              </button>
            </div>

            {/* 시청 중 표시 */}
            {isWatching && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-sm text-cyan-400">디바이스에서 영상 재생 중...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


