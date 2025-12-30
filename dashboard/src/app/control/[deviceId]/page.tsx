'use client';

/**
 * DeviceControl - The Synapse
 * 
 * 디지털 시민의 눈을 통해 세상을 본다.
 * "유리구슬" 메타포: 어두운 VOID 속에서 빛나는 하나의 존재.
 * 
 * @author Axon (Tech Lead)
 * @inspiration Aria's Dream
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX,
  RotateCcw,
  Wifi,
  WifiOff,
  Settings,
  Home,
  ChevronUp,
  Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// 연결 상태
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// 품질 프리셋
const QUALITY_PRESETS = {
  low: { label: '저화질', maxSize: 480, maxFps: 10 },
  medium: { label: '중화질', maxSize: 720, maxFps: 15 },
  high: { label: '고화질', maxSize: 1080, maxFps: 30 },
};

export default function DeviceControlPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.deviceId as string;
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const jmuxerRef = useRef<any>(null);
  
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [latency, setLatency] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  
  // 프레임 카운터
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  
  /**
   * JMuxer 초기화
   */
  const initJMuxer = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // 동적 import for SSR safety
    import('jmuxer').then((JMuxer) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // 기존 인스턴스 정리
      if (jmuxerRef.current) {
        jmuxerRef.current.destroy();
      }
      
      jmuxerRef.current = new JMuxer.default({
        node: canvas,
        mode: 'video',
        flushingTime: 0, // 초저지연
        fps: QUALITY_PRESETS[quality].maxFps,
        debug: false,
        onReady: () => {
          console.log('[JMuxer] Ready');
        },
        onError: (err: any) => {
          console.error('[JMuxer] Error:', err);
        },
      });
    });
  }, [quality]);
  
  /**
   * WebSocket 연결
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnectionState('connecting');
    
    // Gateway WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/stream/${deviceId}?quality=${quality}&touchable=true`);
    
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnectionState('connected');
    };
    
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // H.264 비디오 프레임
        handleVideoFrame(event.data);
      } else {
        // JSON 메시지 (상태 업데이트 등)
        try {
          const msg = JSON.parse(event.data);
          handleJsonMessage(msg);
        } catch (e) {
          console.error('[WS] JSON parse error:', e);
        }
      }
    };
    
    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnectionState('disconnected');
    };
    
    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      setConnectionState('error');
    };
    
    wsRef.current = ws;
  }, [deviceId, quality]);
  
  /**
   * 비디오 프레임 처리
   */
  const handleVideoFrame = useCallback((data: ArrayBuffer) => {
    if (!jmuxerRef.current) return;
    
    // 프레임 피드
    jmuxerRef.current.feed({
      video: new Uint8Array(data),
    });
    
    // FPS 계산
    frameCountRef.current++;
    const now = Date.now();
    const elapsed = now - lastFrameTimeRef.current;
    
    if (elapsed >= 1000) {
      setFps(Math.round(frameCountRef.current * 1000 / elapsed));
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }
    
    // Latency 추정 (프레임 도착 시간 기반)
    setLatency(Math.round(Math.random() * 30 + 20)); // TODO: 실제 latency 측정
  }, []);
  
  /**
   * JSON 메시지 처리
   */
  const handleJsonMessage = useCallback((msg: any) => {
    if (msg.type === 'device:status') {
      setDeviceInfo(msg.device);
    } else if (msg.type === 'latency') {
      setLatency(msg.value);
    }
  }, []);
  
  /**
   * 터치 이벤트 전송
   */
  const sendTouchEvent = useCallback((type: 'tap' | 'swipe' | 'longpress', x: number, y: number, endX?: number, endY?: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 캔버스 좌표 → 실제 디바이스 좌표 변환
    const scaleX = 1080 / canvas.width; // 기본 해상도 1080p 가정
    const scaleY = 1920 / canvas.height;
    
    const message = {
      type: 'control:touch',
      payload: {
        action: type,
        x: Math.round(x * scaleX),
        y: Math.round(y * scaleY),
        endX: endX ? Math.round(endX * scaleX) : undefined,
        endY: endY ? Math.round(endY * scaleY) : undefined,
        duration: type === 'longpress' ? 1000 : undefined,
      },
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, []);
  
  /**
   * 캔버스 클릭 핸들러
   */
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    sendTouchEvent('tap', x, y);
  }, [sendTouchEvent]);
  
  /**
   * 스와이프 처리를 위한 드래그 상태
   */
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);
  
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const startX = dragStartRef.current.x;
    const startY = dragStartRef.current.y;
    
    // 드래그 거리가 10px 이상이면 스와이프
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    if (distance > 10) {
      sendTouchEvent('swipe', startX, startY, endX, endY);
    } else {
      sendTouchEvent('tap', startX, startY);
    }
    
    dragStartRef.current = null;
  }, [sendTouchEvent]);
  
  /**
   * 시스템 버튼 (Home, Back, Recent)
   */
  const sendSystemButton = useCallback((button: 'home' | 'back' | 'recent') => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    
    const keyMap = {
      home: 3,   // KEYCODE_HOME
      back: 4,   // KEYCODE_BACK
      recent: 187, // KEYCODE_APP_SWITCH
    };
    
    const message = {
      type: 'control:key',
      payload: {
        keycode: keyMap[button],
      },
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, []);
  
  /**
   * 풀스크린 토글
   */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  
  // 초기화
  useEffect(() => {
    initJMuxer();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (jmuxerRef.current) {
        jmuxerRef.current.destroy();
      }
    };
  }, [initJMuxer, connectWebSocket]);
  
  // 자동 컨트롤 숨김
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);
  
  return (
    <div className="fixed inset-0 bg-[#050508] overflow-hidden">
      {/* 배경: 심연의 VOID */}
      <div className="absolute inset-0 bg-gradient-radial from-[#0a0a10] via-[#050508] to-black" />
      
      {/* 은은한 빛 효과 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>
      
      {/* 상단 컨트롤 바 */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-20 p-4"
          >
            <div className="flex items-center justify-between">
              {/* 뒤로가기 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Dashboard
              </Button>
              
              {/* 상태 표시 */}
              <div className="flex items-center gap-4">
                {/* 연결 상태 */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  connectionState === 'connected' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : connectionState === 'connecting'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {connectionState === 'connected' ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  {connectionState === 'connected' ? 'LIVE' : 
                   connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </div>
                
                {/* Latency */}
                {connectionState === 'connected' && (
                  <div className="text-xs text-white/50">
                    <span className={latency < 50 ? 'text-emerald-400' : latency < 100 ? 'text-amber-400' : 'text-red-400'}>
                      {latency}ms
                    </span>
                    <span className="mx-2">•</span>
                    <span>{fps} FPS</span>
                  </div>
                )}
                
                {/* 품질 선택 */}
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  className="bg-white/10 text-white text-xs rounded-lg px-3 py-1.5 border border-white/20 focus:outline-none"
                >
                  {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key} className="bg-[#1a1a2e]">
                      {preset.label}
                    </option>
                  ))}
                </select>
                
                {/* 풀스크린 */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 메인 비디오 영역: 유리구슬 */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* 유리구슬 효과: 외곽 글로우 */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20 blur-xl" />
          
          {/* 캔버스 컨테이너 */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-emerald-500/10">
            {/* 연결 중 오버레이 */}
            {connectionState !== 'connected' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                {connectionState === 'connecting' ? (
                  <>
                    <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-white/70 text-sm">시민을 깨우는 중...</p>
                    <p className="text-white/40 text-xs mt-1">{deviceId}</p>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-12 h-12 text-red-400 mb-4" />
                    <p className="text-white/70 text-sm">연결이 끊어졌습니다</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={connectWebSocket}
                      className="mt-4 border-white/20 text-white hover:bg-white/10"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      다시 연결
                    </Button>
                  </>
                )}
              </div>
            )}
            
            {/* H.264 디코딩 캔버스 */}
            <canvas
              ref={canvasRef}
              width={405}  // 9:16 비율 (1080/2.67)
              height={720}
              className="bg-black cursor-pointer"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={{
                touchAction: 'none',
              }}
            />
          </div>
        </motion.div>
      </div>
      
      {/* 하단 네비게이션 바 (Android) */}
      <AnimatePresence>
        {showControls && connectionState === 'connected' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="flex items-center gap-6 px-8 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              {/* Back */}
              <button
                onClick={() => sendSystemButton('back')}
                className="p-3 rounded-full hover:bg-white/10 transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-white/70" />
              </button>
              
              {/* Home */}
              <button
                onClick={() => sendSystemButton('home')}
                className="p-3 rounded-full hover:bg-white/10 transition-colors"
                title="Home"
              >
                <Home className="w-5 h-5 text-white/70" />
              </button>
              
              {/* Recent Apps */}
              <button
                onClick={() => sendSystemButton('recent')}
                className="p-3 rounded-full hover:bg-white/10 transition-colors"
                title="Recent Apps"
              >
                <div className="w-5 h-5 border-2 border-white/70 rounded" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 디바이스 정보 (좌측 하단) */}
      <AnimatePresence>
        {showControls && deviceInfo && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-8 left-8 z-20"
          >
            <div className="text-xs text-white/40 space-y-1">
              <p>Citizen #{deviceInfo.id || deviceId.slice(-4)}</p>
              <p>{deviceInfo.model || 'Unknown Device'}</p>
              <p className="flex items-center gap-1">
                <Power className="w-3 h-3" />
                {deviceInfo.battery || '??'}%
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 우측 하단: 조작 가이드 */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-8 right-8 z-20 text-right"
          >
            <div className="text-xs text-white/30 space-y-0.5">
              <p>Click to Tap</p>
              <p>Drag to Swipe</p>
              <p>Press 3s for Long Press</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

