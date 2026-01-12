'use client';

// ============================================
// NodeStatusBar v4.0
// 노드(PC) + 디바이스(스마트폰) 상태 + 복구 기능
// ============================================

import React from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Monitor, Smartphone, Zap, AlertCircle, RotateCcw } from 'lucide-react';
import { GatewayNode, Device, ConnectionStatus } from '../../contexts/NodeContext';

interface NodeStatusBarProps {
  gatewayNode: GatewayNode | null;
  devices: Device[];
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  laixiConnected: boolean;
  isDark: boolean;
  onReconnect?: () => void;
  onRefreshDevices?: () => void;
  onRecoverDevice?: (deviceId: string) => void;
}

export function NodeStatusBar({
  gatewayNode,
  devices,
  connectionStatus,
  reconnectAttempt,
  laixiConnected,
  isDark,
  onReconnect,
  onRefreshDevices,
  onRecoverDevice,
}: NodeStatusBarProps) {
  // 디바이스 통계
  const stats = {
    total: devices.length,
    idle: devices.filter(d => d.status === 'idle').length,
    busy: devices.filter(d => d.status === 'busy').length,
    error: devices.filter(d => d.status === 'error').length,
    offline: devices.filter(d => d.status === 'offline').length,
  };

  // 에러 상태 디바이스
  const errorDevices = devices.filter(d => d.status === 'error');

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-400" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'BRIDGE 연결됨';
      case 'connecting':
        return reconnectAttempt > 0 ? `재연결 중 (${reconnectAttempt}/20)` : '연결 중...';
      case 'error':
        return '연결 오류';
      default:
        return reconnectAttempt > 0 ? `대기 중 (${reconnectAttempt}/20)` : '연결 안됨';
    }
  };

  const getNodeStatusColor = () => {
    if (!gatewayNode) return 'text-neutral-500';
    switch (gatewayNode.status) {
      case 'online':
        return 'text-green-400';
      case 'reconnecting':
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  return (
    <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white/80 border-black/10'} backdrop-blur-md border rounded-lg px-4 py-3`}>
      {/* 상단: 노드(PC) 정보 */}
      <div className={`flex items-center justify-between mb-3 pb-3 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        {/* 노드 정보 */}
        <div className="flex items-center gap-4">
          {/* 노드 아이콘 + 호스트명 */}
          <div className="flex items-center gap-2">
            <Monitor className={`w-5 h-5 ${getNodeStatusColor()}`} />
            <div>
              <span className="font-mono text-sm font-medium">
                {gatewayNode ? gatewayNode.hostname : '노드 없음'}
              </span>
              {gatewayNode && (
                <span className="ml-2 text-xs text-neutral-500">
                  {gatewayNode.ipAddress}
                </span>
              )}
            </div>
            {gatewayNode?.status === 'reconnecting' && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded animate-pulse">
                재연결 중 ({gatewayNode.reconnectAttempts}/10)
              </span>
            )}
          </div>

          {/* Bridge 연결 상태 */}
          <div className={`flex items-center gap-2 pl-4 border-l ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            {getConnectionIcon()}
            <span className="text-xs font-mono text-neutral-400">
              {getConnectionText()}
            </span>
          </div>

          {/* Laixi 연결 상태 */}
          <div className={`flex items-center gap-2 pl-4 border-l ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            <Zap className={`w-4 h-4 ${laixiConnected ? 'text-yellow-400' : 'text-neutral-600'}`} />
            <span className={`text-xs font-mono ${laixiConnected ? 'text-yellow-400' : 'text-neutral-500'}`}>
              {laixiConnected ? 'Laixi 연결됨' : 'Laixi 연결 안됨'}
            </span>
          </div>
        </div>

        {/* 버튼들 */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'disconnected' && onReconnect && (
            <button
              onClick={onReconnect}
              className="px-3 py-1 text-xs bg-[#FFCC00]/20 text-[#FFCC00] rounded hover:bg-[#FFCC00]/30 transition-colors"
            >
              Bridge 재연결
            </button>
          )}
          {connectionStatus === 'connected' && onRefreshDevices && (
            <button
              onClick={onRefreshDevices}
              className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              새로고침
            </button>
          )}
        </div>
      </div>

      {/* 중단: 에러 디바이스 알림 (있을 경우) */}
      {errorDevices.length > 0 && (
        <div className={`mb-3 pb-3 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">{errorDevices.length}개 디바이스 오류</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {errorDevices.map(device => (
              <div
                key={device.id}
                className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs"
              >
                <span className="text-red-300">{device.name}</span>
                <span className="text-red-400/60 truncate max-w-[150px]" title={device.errorMessage}>
                  {device.errorMessage || '알 수 없는 오류'}
                </span>
                {onRecoverDevice && (
                  <button
                    onClick={() => onRecoverDevice(device.id)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                    title="복구 시도"
                  >
                    <RotateCcw className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단: 디바이스(스마트폰) 상태 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 font-mono text-sm">
          {/* 디바이스 아이콘 */}
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
              디바이스
            </span>
          </div>

          {/* 통계 */}
          <span>
            전체: <strong className={isDark ? 'text-white' : 'text-black'}>{stats.total}</strong>
          </span>
          <span>
            대기: <strong className="text-green-400">{stats.idle}</strong>
          </span>
          <span>
            작업중: <strong className="text-[#FFCC00]">{stats.busy}</strong>
          </span>
          {stats.error > 0 && (
            <span>
              오류: <strong className="text-red-500">{stats.error}</strong>
            </span>
          )}
          {stats.offline > 0 && (
            <span>
              오프라인: <strong className="text-neutral-500">{stats.offline}</strong>
            </span>
          )}
        </div>

        {/* 디바이스 미니 그리드 */}
        <div className="flex items-center gap-1.5 max-w-[400px] flex-wrap justify-end">
          {devices.length === 0 ? (
            <span className="text-xs text-neutral-500 italic">디바이스 없음</span>
          ) : (
            devices.map(device => (
              <div
                key={device.id}
                className={`w-3 h-3 rounded-sm transition-all cursor-pointer hover:scale-125 ${getDeviceColorClass(device.status, isDark)}`}
                title={`${device.name}\n모델: ${device.model}\n상태: ${getStatusLabel(device.status)}${device.errorMessage ? `\n오류: ${device.errorMessage}` : ''}\nID: ${device.serial}`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getDeviceColorClass(status: string, isDark: boolean): string {
  switch (status) {
    case 'busy':
      return 'bg-[#FFCC00] shadow-[0_0_4px_rgba(255,204,0,0.6)]';
    case 'idle':
      return isDark ? 'bg-green-400/70' : 'bg-green-500/60';
    case 'error':
      return 'bg-red-500 animate-pulse';
    case 'offline':
      return isDark ? 'bg-neutral-700' : 'bg-neutral-400';
    default:
      return isDark ? 'bg-neutral-600/50' : 'bg-neutral-400/40';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'busy':
      return '작업 중';
    case 'idle':
      return '대기 중';
    case 'error':
      return '오류';
    case 'offline':
      return '오프라인';
    default:
      return status;
  }
}
