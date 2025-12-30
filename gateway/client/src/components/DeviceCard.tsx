/**
 * DeviceCard Component
 * 단일 디바이스 썸네일 + 상태
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { VideoCanvas } from './VideoCanvas';
import type { DiscoveredDevice } from '../types';
import type { StreamQuality } from '../lib/grid-calculator';

interface DeviceCardProps {
  device: DiscoveredDevice;
  width: number;
  height: number;
  streamQuality: StreamQuality;
  onClick: () => void;
}

export function DeviceCard({ 
  device, 
  width, 
  height, 
  streamQuality,
  onClick 
}: DeviceCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const statusColor = {
    ONLINE: 'bg-green-500',
    OFFLINE: 'bg-gray-500',
    CONNECTING: 'bg-yellow-500',
    ERROR: 'bg-red-500'
  }[device.status] || 'bg-gray-500';
  
  // 존재 점수 아이콘
  const existenceIcon = 
    (device.metrics?.existence_score ?? 0.5) > 0.7 ? '💚' :
    (device.metrics?.existence_score ?? 0.5) > 0.4 ? '💛' :
    (device.metrics?.existence_score ?? 0.5) > 0.1 ? '🧡' : '💔';
  
  const connectionIcon = {
    USB: '🔌',
    WIFI: '📶',
    LAN: '🌐'
  }[device.connectionType] || '❓';
  
  return (
    <div
      className={clsx(
        'relative rounded-lg overflow-hidden cursor-pointer',
        'transition-all duration-200',
        isHovered ? 'ring-2 ring-blue-400 scale-[1.02]' : 'ring-1 ring-gray-700'
      )}
      style={{ width, height }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 비디오 스트림 또는 오프라인 표시 */}
      {device.status === 'ONLINE' ? (
        <VideoCanvas
          deviceId={device.serial}
          quality={streamQuality}
          width={width}
          height={height}
        />
      ) : (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <span className="text-gray-500 text-4xl">📵</span>
        </div>
      )}
      
      {/* 오버레이: 상태 및 정보 */}
      <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
        {/* 상단: 상태 배지 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className={clsx('w-2 h-2 rounded-full', statusColor)} />
            {device.gatewayClientConnected && (
              <span className="text-xs">🔗</span>
            )}
          </div>
          <span className="text-xs bg-black/50 px-1 rounded">
            {connectionIcon}
          </span>
        </div>
        
        {/* 하단: 디바이스 정보 */}
        <div className="bg-black/60 rounded px-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white truncate max-w-[80%]">
              {device.aiCitizen?.name || device.aiCitizenId || device.serial.slice(0, 12)}
            </span>
            <span className="text-sm">{existenceIcon}</span>
          </div>
          {device.metrics && (
            <div className="text-[10px] text-gray-400">
              E: {((device.metrics.existence_score ?? 0.5) * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>
      
      {/* 호버 시 모델 정보 */}
      {isHovered && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded">
          {device.model || 'Unknown Device'}
        </div>
      )}
    </div>
  );
}

