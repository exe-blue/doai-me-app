/**
 * VideoCanvas Component
 * H.264 WebSocket 스트림 디코더 + Canvas 렌더링
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useRef, useEffect, useState } from 'react';
import type { StreamQuality } from '../lib/grid-calculator';

interface VideoCanvasProps {
  deviceId: string;
  quality: StreamQuality;
  width: number;
  height: number;
}

export function VideoCanvas({ deviceId, quality, width, height }: VideoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [fps, setFps] = useState(0);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Iframe 방식 사용 (간단한 폴백)
    // TODO: WebSocket Binary 스트림 구현
    
    let frameCount = 0;
    let lastTime = Date.now();
    
    // 스크린샷 기반 폴백 (개발용)
    const updateFrame = async () => {
      try {
        const response = await fetch(`/api/control/${encodeURIComponent(deviceId)}/screenshot`);
        if (!response.ok) throw new Error('Screenshot failed');
        
        const blob = await response.blob();
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(img.src);
          
          frameCount++;
          const now = Date.now();
          if (now - lastTime >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            lastTime = now;
          }
        };
        img.src = URL.createObjectURL(blob);
        setStatus('connected');
      } catch {
        setStatus('error');
      }
    };
    
    // FPS에 따른 인터벌
    const interval = Math.max(1000 / quality.maxFps, 200);
    updateFrame();
    const timer = setInterval(updateFrame, interval);
    
    return () => clearInterval(timer);
  }, [deviceId, quality.maxFps]);
  
  return (
    <div className="relative w-full h-full bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ width, height }}
      />
      
      {/* 상태 오버레이 */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-white text-sm animate-pulse">Connecting...</span>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-red-400 text-sm">Stream Error</span>
        </div>
      )}
      
      {/* FPS 표시 */}
      {status === 'connected' && fps > 0 && (
        <div className="absolute top-1 right-1 text-[10px] text-green-400 bg-black/50 px-1 rounded">
          {fps} fps
        </div>
      )}
    </div>
  );
}

