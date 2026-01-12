/**
 * Dashboard Page - Consume (Market Layout Port)
 *
 * Market 페이지 레이아웃 포팅
 * - NodeContext를 통한 WebSocket 연결
 * - 노드/디바이스 상태 모니터링
 * - 영상 등록 및 대기열 관리
 *
 * @author Axon (Tech Lead)
 */

import React, { useState, useCallback } from 'react';
import { NodeProvider, useNodes } from '@/contexts/NodeContext';
import { Moon, Sun, Monitor, Smartphone, Wifi, WifiOff, RefreshCw } from 'lucide-react';

// Market 컴포넌트 임포트
import {
  NodeStatusBar,
  WatchedStatsBar,
  CurrentlyWatchingPanel,
  InjectionPanel,
  LaixiPanel,
  QueuePanel,
  LogsPanel,
  CompletedPanel,
  HistoryPanel,
} from '@/components/market';

export default function DashboardPage() {
  return (
    <NodeProvider wsEndpoint="ws://localhost:3100/ws/dashboard">
      <ConsumeContent />
    </NodeProvider>
  );
}

function ConsumeContent() {
  const [isDark, setIsDark] = useState(true);
  const {
    state,
    nodes,
    devices,
    addLog,
    connect,
    refreshDevices,
    sendCommand,
  } = useNodes();

  // 테마 토글
  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  // 재연결 핸들러
  const handleReconnect = useCallback(() => {
    addLog('info', 'Bridge 재연결 시도...');
    connect();
  }, [addLog, connect]);

  // 디바이스 새로고침 핸들러
  const handleRefreshDevices = useCallback(() => {
    addLog('info', '디바이스 새로고침...');
    refreshDevices();
  }, [addLog, refreshDevices]);

  // 디바이스 복구 핸들러
  const handleRecoverDevice = useCallback((deviceId: string) => {
    addLog('info', `디바이스 복구 시도: ${deviceId}`);
    sendCommand(deviceId, 'recover', {});
  }, [addLog, sendCommand]);

  // 첫 번째 노드 가져오기 (현재는 단일 노드)
  const primaryNode = nodes[0] || null;
  const laixiConnected = primaryNode?.laixiConnected || false;

  // 연결 상태
  const isConnected = state.connectionStatus === 'connected';
  const isConnecting = state.connectionStatus === 'connecting';

  const runningCount = state.queuedVideos.filter(v => v.status === 'running').length;
  const onlineDeviceCount = devices.filter(d => d.status !== 'offline').length;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-[#0A0A0A]' : 'bg-[#F5F5F5]'} transition-colors duration-300`}>
      {/* CRT Scanlines */}
      {isDark && (
        <div
          className="scanlines fixed inset-0 pointer-events-none z-10 opacity-20"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.15),
              rgba(0, 0, 0, 0.15) 1px,
              transparent 1px,
              transparent 2px
            )`,
          }}
        />
      )}

      {/* 고정 헤더 */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-16 ${isDark ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-md border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
          {/* 로고 & 타이틀 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[#FFCC00]">Consume</span>
              <span className={`text-sm ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>Control Room</span>
            </div>
          </div>

          {/* 상태 표시 + 컨트롤 */}
          <div className="flex items-center gap-4">
            {/* 연결 상태 인디케이터 */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              {/* Bridge 연결 */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                isConnected ? 'bg-green-500/20 text-green-400' :
                isConnecting ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>Bridge</span>
              </div>

              {/* 노드 */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                primaryNode ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-500/20 text-neutral-500'
              }`}>
                <Monitor className="w-3 h-3" />
                <span>{nodes.length}</span>
              </div>

              {/* 디바이스 */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                onlineDeviceCount > 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-neutral-500/20 text-neutral-500'
              }`}>
                <Smartphone className="w-3 h-3" />
                <span>{onlineDeviceCount}/{devices.length}</span>
              </div>
            </div>

            {/* 테마 토글 */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
              title={isDark ? '라이트 모드' : '다크 모드'}
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 연결 오류 배너 */}
      {!isConnected && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg flex items-center gap-3 ${
          isConnecting
            ? 'bg-yellow-500 text-black'
            : 'bg-red-500 text-white'
        }`}>
          {isConnecting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {state.reconnectAttempt > 0
                ? `재연결 중... (${state.reconnectAttempt}/20)`
                : 'Bridge 연결 중...'
              }
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Bridge 연결 안됨
              <button
                onClick={handleReconnect}
                className="px-3 py-1 bg-white/20 rounded-full hover:bg-white/30 transition-colors text-xs font-bold"
              >
                재연결
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative w-full overflow-y-auto z-20 pt-24 pb-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">

          {/* 1. 노드(PC) + 디바이스(스마트폰) 상태 */}
          <NodeStatusBar
            gatewayNode={primaryNode}
            devices={devices}
            connectionStatus={state.connectionStatus}
            reconnectAttempt={state.reconnectAttempt}
            laixiConnected={laixiConnected}
            isDark={isDark}
            onReconnect={handleReconnect}
            onRefreshDevices={handleRefreshDevices}
            onRecoverDevice={handleRecoverDevice}
          />

          {/* 2. 시청 통계 */}
          <WatchedStatsBar
            stats={state.stats}
            queuedCount={state.queuedVideos.length}
            runningCount={runningCount}
            isDark={isDark}
          />

          {/* 3. 현재 시청중 */}
          <CurrentlyWatchingPanel
            devices={devices}
            queuedVideos={state.queuedVideos}
            isDark={isDark}
          />

          {/* 4. 동영상 등록 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* 4-1. Bridge 방식 (기존) */}
            <InjectionPanel isDark={isDark} />

            {/* 4-2. Laixi 로컬 제어 */}
            <LaixiPanel isDark={isDark} />
          </div>

          {/* 5. 대기열 + 로그 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <QueuePanel
                queuedVideos={state.queuedVideos}
                isDark={isDark}
              />
            </div>
            <div className="lg:col-span-7">
              <LogsPanel
                logs={state.logs}
                isDark={isDark}
              />
            </div>
          </div>

          {/* 6. 완료 목록 + 히스토리 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CompletedPanel
              completedVideos={state.completedVideos}
              isDark={isDark}
            />
            <HistoryPanel isDark={isDark} />
          </div>

        </div>
      </main>
    </div>
  );
}
