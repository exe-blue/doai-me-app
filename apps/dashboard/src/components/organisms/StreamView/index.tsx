/**
 * StreamView Component
 * 
 * 디바이스 화면 실시간 스트림 뷰
 * - WebSocket을 통한 jmuxer H.264 스트림
 * - 폴백: 주기적 스크린샷
 * 
 * @author Axon (Tech Lead)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { getScreenshot } from '@/services/api';
import { Button } from '@/components/atoms';

interface StreamViewProps {
  deviceId: string;
  isExpanded: boolean;
  className?: string;
}

type StreamMode = 'stream' | 'screenshot' | 'loading' | 'error';

export const StreamView: React.FC<StreamViewProps> = ({
  deviceId,
  isExpanded,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const jmuxerRef = useRef<unknown>(null);
  
  const [mode, setMode] = useState<StreamMode>('loading');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref로 현재 스크린샷 URL 추적 (stale closure 방지)
  const screenshotUrlRef = useRef<string | null>(null);

  // 스크린샷 갱신 - stale closure 수정: ref를 사용하여 이전 URL 해제
  const refreshScreenshot = useCallback(async () => {
    if (!isExpanded) return;
    
    setIsRefreshing(true);
    
    try {
      const url = await getScreenshot(deviceId);
      
      // ref를 통해 이전 URL 해제 (stale closure 방지)
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
      }
      
      // ref와 state 모두 업데이트
      screenshotUrlRef.current = url;
      setScreenshotUrl(url);
      setError(null);
      setMode('screenshot');
    } catch (e) {
      console.error('[Stream] 스크린샷 실패:', e);
      setError('화면을 가져올 수 없습니다');
      setMode('error');
    } finally {
      setIsRefreshing(false);
    }
  }, [deviceId, isExpanded]);

  // 스크린샷 모드로 폴백
  const fallbackToScreenshot = useCallback(() => {
    setMode('screenshot');
    refreshScreenshot();
    
    // 3초마다 스크린샷 갱신
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
    screenshotIntervalRef.current = setInterval(refreshScreenshot, 3000);
  }, [refreshScreenshot]);

  // jmuxer 스트림 초기화
  const initStream = useCallback(async () => {
    if (!isExpanded || !videoRef.current) return;
    
    setMode('loading');
    setError(null);
    
    try {
      // jmuxer 동적 import
      const JMuxer = (await import('jmuxer')).default;
      
      // WebSocket 스트림 연결
      const wsUrl = `ws://${window.location.host}/ws/stream/${deviceId}`;
      wsRef.current = new WebSocket(wsUrl);
      
      jmuxerRef.current = new JMuxer({
        node: videoRef.current,
        mode: 'video',
        flushingTime: 0,
        fps: 30,
        debug: false,
      });
      
      wsRef.current.binaryType = 'arraybuffer';
      
      wsRef.current.onopen = () => {
        console.log(`[Stream] ${deviceId} 스트림 연결됨`);
        setMode('stream');
      };
      
      wsRef.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          (jmuxerRef.current as { feed: (data: { video: Uint8Array }) => void })?.feed({ video: data });
        }
      };
      
      wsRef.current.onerror = () => {
        console.warn(`[Stream] ${deviceId} 스트림 오류, 스크린샷 모드로 전환`);
        fallbackToScreenshot();
      };
      
      wsRef.current.onclose = () => {
        console.log(`[Stream] ${deviceId} 스트림 종료`);
        if (isExpanded) {
          fallbackToScreenshot();
        }
      };
      
    } catch (e) {
      console.warn('[Stream] jmuxer 초기화 실패:', e);
      fallbackToScreenshot();
    }
  }, [deviceId, isExpanded, fallbackToScreenshot]);

  // 확장/축소 시 스트림 관리
  useEffect(() => {
    if (isExpanded) {
      initStream();
    } else {
      // 정리
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (jmuxerRef.current) {
        (jmuxerRef.current as { destroy: () => void }).destroy();
        jmuxerRef.current = null;
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
      // ref를 통해 URL 해제
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
        screenshotUrlRef.current = null;
        setScreenshotUrl(null);
      }
      setMode('loading');
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (jmuxerRef.current) {
        (jmuxerRef.current as { destroy: () => void }).destroy();
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
      }
    };
  }, [isExpanded, deviceId, initStream]);

  if (!isExpanded) return null;

  return (
    <div className={clsx('relative bg-void-950 rounded-lg overflow-hidden', className)}>
      {/* 스트림 모드 */}
      {mode === 'stream' && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto object-contain"
          style={{ aspectRatio: '9/16' }}
        />
      )}
      
      {/* 스크린샷 모드 */}
      {mode === 'screenshot' && screenshotUrl && (
        <div className="relative">
          <img
            ref={imgRef}
            src={screenshotUrl}
            alt={`${deviceId} screen`}
            className={clsx(
              'w-full h-auto object-contain transition-opacity',
              isRefreshing && 'opacity-70'
            )}
            style={{ aspectRatio: '9/16' }}
          />
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-xs text-void-400 bg-void-800/80 px-2 py-1 rounded">
              📸 Screenshot Mode
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshScreenshot}
              disabled={isRefreshing}
              className="bg-void-800/80"
            >
              {isRefreshing ? '⏳' : '🔄'}
            </Button>
          </div>
        </div>
      )}
      
      {/* 로딩 상태 */}
      {mode === 'loading' && (
        <div 
          className="flex items-center justify-center bg-void-900"
          style={{ aspectRatio: '9/16' }}
        >
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-doai-yellow-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-void-400 text-sm">스트림 연결 중...</p>
          </div>
        </div>
      )}
      
      {/* 에러 상태 */}
      {mode === 'error' && (
        <div 
          className="flex items-center justify-center bg-void-900"
          style={{ aspectRatio: '9/16' }}
        >
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">⚠️</p>
            <p className="text-void-400 text-sm">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={initStream}
              className="mt-4"
            >
              재시도
            </Button>
          </div>
        </div>
      )}
      
      {/* 모드 표시 */}
      <div className="absolute bottom-2 left-2">
        <span className={clsx(
          'text-xs px-2 py-1 rounded',
          mode === 'stream' ? 'bg-green-600 text-white' : 'bg-void-700 text-void-300'
        )}>
          {mode === 'stream' ? '🔴 LIVE' : mode === 'screenshot' ? '📷 SNAPSHOT' : mode === 'loading' ? '⏳' : '❌'}
        </span>
      </div>
    </div>
  );
};
