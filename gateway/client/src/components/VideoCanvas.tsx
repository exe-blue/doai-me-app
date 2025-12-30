/**
 * VideoCanvas Component
 * jmuxer 기반 H.264 WebSocket 스트림 디코더 + Canvas 렌더링
 * 
 * 재연결 로직: 3회 시도, 10초 간격
 * 
 * @author Axon (Tech Lead)
 * @version 2.2.0
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import JMuxer from 'jmuxer';
import type { StreamQuality } from '../lib/grid-calculator';

// 재연결 설정
const RECONNECT_CONFIG = {
  maxAttempts: 3,
  intervalMs: 10000,
  backoffMultiplier: 1.5
};

// 스트림 상태
type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline';

interface VideoCanvasProps {
  deviceId: string;
  quality: StreamQuality;
  width: number;
  height: number;
  isVisible?: boolean;  // 화면에 보이는지 (visible-only streaming)
}

export function VideoCanvas({ 
  deviceId, 
  quality, 
  width, 
  height, 
  isVisible = true 
}: VideoCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const jmuxerRef = useRef<JMuxer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  
  // 재연결 카운터를 useRef로 관리하여 stale closure 방지
  const reconnectAttemptRef = useRef(0);
  
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [reconnectAttempt, setReconnectAttempt] = useState(0); // UI 표시용
  const [fps, setFps] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // FPS 카운터
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  /**
   * WebSocket 연결 정리
   */
  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /**
   * jmuxer 정리
   */
  const cleanupJMuxer = useCallback(() => {
    if (jmuxerRef.current) {
      jmuxerRef.current.destroy();
      jmuxerRef.current = null;
    }
  }, []);

  /**
   * jmuxer 초기화
   */
  const initJMuxer = useCallback(() => {
    if (!videoRef.current || jmuxerRef.current) return;
    
    jmuxerRef.current = new JMuxer({
      node: videoRef.current,
      mode: 'video',
      fps: quality.maxFps,
      flushingTime: 100,
      clearBuffer: true,
      debug: false,
      onReady: () => {
        console.log(`[VideoCanvas] jmuxer ready for ${deviceId}`);
      },
      onError: (err) => {
        console.error(`[VideoCanvas] jmuxer error for ${deviceId}:`, err);
        setErrorMessage('디코더 오류');
      }
    });
  }, [deviceId, quality.maxFps]);

  /**
   * WebSocket 스트림 연결
   * 재연결 로직을 내부에서 처리하여 stale closure 방지
   */
  const connectStream = useCallback(() => {
    if (!isVisible) {
      setStatus('idle');
      return;
    }
    
    cleanupWebSocket();
    setStatus('connecting');
    setErrorMessage(null);
    
    // WebSocket 연결
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/stream/${encodeURIComponent(deviceId)}`;
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log(`[VideoCanvas] ${deviceId} WebSocket connected`);
      setStatus('connected');
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setErrorMessage(null);
      
      // 스트림 구독 메시지 전송
      ws.send(JSON.stringify({
        type: 'stream:subscribe',
        deviceId,
        quality: {
          resolution: quality.resolution,
          maxFps: quality.maxFps,
          maxBitrate: quality.maxBitrate
        }
      }));
    };
    
    ws.onmessage = (event) => {
      // Binary 데이터 (H.264 NAL units)
      if (event.data instanceof ArrayBuffer) {
        if (!jmuxerRef.current) {
          initJMuxer();
        }
        
        // jmuxer에 데이터 피딩
        const data = new Uint8Array(event.data);
        jmuxerRef.current?.feed({
          video: data
        });
        
        // FPS 계산
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
        
        return;
      }
      
      // JSON 메시지 (상태 업데이트 등)
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'stream:error') {
          setErrorMessage(message.message);
        }
      } catch {
        // 무시
      }
    };
    
    ws.onerror = (event) => {
      console.error(`[VideoCanvas] ${deviceId} WebSocket error:`, event);
    };
    
    ws.onclose = (event) => {
      console.log(`[VideoCanvas] ${deviceId} WebSocket closed:`, event.code, event.reason);
      
      // 정상 종료가 아니면 재연결
      if (event.code !== 1000 && isVisible) {
        // 현재 시도 횟수 확인 (ref에서 읽어 stale closure 방지)
        const currentAttempt = reconnectAttemptRef.current;
        
        if (currentAttempt >= RECONNECT_CONFIG.maxAttempts) {
          setStatus('error');
          setErrorMessage(`재연결 실패 (${RECONNECT_CONFIG.maxAttempts}회 시도)`);
          return;
        }
        
        // 재연결 스케줄링
        const delay = RECONNECT_CONFIG.intervalMs * Math.pow(RECONNECT_CONFIG.backoffMultiplier, currentAttempt);
        console.log(`[VideoCanvas] ${deviceId} 재연결 ${currentAttempt + 1}/${RECONNECT_CONFIG.maxAttempts} - ${Math.round(delay / 1000)}초 후`);
        
        setStatus('reconnecting');
        reconnectAttemptRef.current = currentAttempt + 1;
        setReconnectAttempt(currentAttempt + 1);
        
        // 기존 타이머 정리 후 새 타이머 설정
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        
        reconnectTimerRef.current = window.setTimeout(() => {
          connectStream();
        }, delay);
      } else {
        setStatus('offline');
      }
    };
  }, [deviceId, quality, isVisible, initJMuxer, cleanupWebSocket]);

  // 컴포넌트 마운트/언마운트
  useEffect(() => {
    if (isVisible) {
      initJMuxer();
      connectStream();
    }
    
    return () => {
      cleanupWebSocket();
      cleanupJMuxer();
    };
  }, [isVisible, initJMuxer, connectStream, cleanupWebSocket, cleanupJMuxer]);
  
  // 품질 변경 시 재연결
  useEffect(() => {
    if (status === 'connected' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stream:quality',
        deviceId,
        quality: {
          resolution: quality.resolution,
          maxFps: quality.maxFps,
          maxBitrate: quality.maxBitrate
        }
      }));
    }
  }, [quality, deviceId, status]);

  /**
   * 수동 재연결 핸들러
   */
  const handleManualReconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    connectStream();
  }, [connectStream]);

  // 상태별 아이콘
  const statusIcon = {
    idle: '⏸️',
    connecting: '🔄',
    connected: '📺',
    reconnecting: '🔁',
    error: '❌',
    offline: '📵'
  };

  return (
    <div 
      className="relative w-full h-full bg-room-900 rounded-lg overflow-hidden"
      style={{ width, height }}
    >
      {/* Video Element (jmuxer target) */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        autoPlay
        muted
        playsInline
      />
      
      {/* 빈 상태 / 에러 오버레이 */}
      {status !== 'connected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-room-800/90 backdrop-blur-sm">
          <span className="text-4xl mb-2">
            {statusIcon[status]}
          </span>
          
          {status === 'idle' && (
            <span className="text-gray-500 text-sm">대기 중</span>
          )}
          
          {status === 'connecting' && (
            <span className="text-doai-400 text-sm animate-pulse">연결 중...</span>
          )}
          
          {status === 'reconnecting' && (
            <div className="text-center">
              <span className="text-yellow-400 text-sm block">
                재연결 중 ({reconnectAttempt}/{RECONNECT_CONFIG.maxAttempts})
              </span>
              <span className="text-gray-500 text-xs mt-1 block">
                잠시 후 다시 시도합니다...
              </span>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center">
              <span className="text-red-400 text-sm block">연결 실패</span>
              {errorMessage && (
                <span className="text-gray-500 text-xs mt-1 block">{errorMessage}</span>
              )}
              <button
                onClick={handleManualReconnect}
                className="mt-3 px-3 py-1 bg-room-600 hover:bg-room-500 text-white text-xs rounded transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}
          
          {status === 'offline' && (
            <div className="text-center">
              <span className="text-gray-400 text-sm block">오프라인</span>
              <span className="text-gray-500 text-xs mt-1 block">디바이스가 연결되지 않음</span>
            </div>
          )}
        </div>
      )}
      
      {/* 연결됨: FPS 표시 */}
      {status === 'connected' && fps > 0 && (
        <div className="absolute top-1 right-1 flex items-center gap-1 text-[10px] bg-black/60 px-1.5 py-0.5 rounded font-mono">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-green-400">{fps}fps</span>
        </div>
      )}
      
      {/* 품질 배지 */}
      {status === 'connected' && (
        <div className="absolute bottom-1 left-1 text-[9px] bg-black/60 px-1.5 py-0.5 rounded font-mono text-gray-400">
          {quality.resolution}
        </div>
      )}
    </div>
  );
}

/**
 * 빈 상태 컴포넌트 (디바이스 없음)
 */
export function EmptyVideoCanvas({ width, height }: { width: number; height: number }) {
  return (
    <div 
      className="relative bg-room-800 rounded-lg overflow-hidden flex items-center justify-center border border-room-600 border-dashed"
      style={{ width, height }}
    >
      <div className="text-center">
        <span className="text-4xl block mb-2">📱</span>
        <span className="text-gray-500 text-sm">디바이스 없음</span>
      </div>
    </div>
  );
}
