/**
 * Dashboard Page
 * 디바이스 그리드 뷰
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useRef, useState, useCallback } from 'react';
import { useDevices } from '../hooks/useDevices';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGridLayout } from '../hooks/useGridLayout';
import { DeviceGrid } from '../components/DeviceGrid';
import { GlobalActionBar } from '../components/GlobalActionBar';
import { StatusBar } from '../components/StatusBar';

export default function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  // 디바이스 목록 (SWR)
  const { devices, isLoading, error, mutate } = useDevices();
  
  // WebSocket 연결
  const { isConnected, sendMessage } = useWebSocket();
  
  // 그리드 레이아웃 계산
  const layout = useGridLayout(containerRef, devices.length);
  
  // 현재 페이지에 표시할 디바이스
  const visibleDevices = devices.slice(
    currentPage * layout.pagination.devicesPerPage,
    (currentPage + 1) * layout.pagination.devicesPerPage
  );
  
  // 글로벌 액션 핸들러
  const handleGlobalAction = useCallback((action: { type: string; [key: string]: unknown }) => {
    switch (action.type) {
      case 'RESCAN':
        fetch('/api/discovery/scan', { method: 'POST' })
          .then(() => mutate());
        break;
      case 'ACCIDENT':
      case 'POP':
      case 'ZOMBIE_RECOVERY':
        sendMessage({
          type: 'dispatch',
          target: '*',
          message: action
        });
        break;
    }
  }, [mutate, sendMessage]);
  
  // 디바이스 선택 핸들러
  const handleDeviceClick = useCallback((deviceId: string) => {
    window.location.href = `/device/${encodeURIComponent(deviceId)}`;
  }, []);
  
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* 상단 액션 바 */}
      <GlobalActionBar
        deviceCount={devices.length}
        onlineCount={devices.filter(d => d.status === 'ONLINE').length}
        isConnected={isConnected}
        onAction={handleGlobalAction}
      />
      
      {/* 메인 그리드 영역 */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-lg">🔄 Loading devices...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400 text-lg">❌ {error.message}</div>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-6xl">📵</div>
            <div className="text-gray-400 text-lg">No devices found</div>
            <button
              onClick={() => handleGlobalAction({ type: 'RESCAN' })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🔄 Scan for Devices
            </button>
          </div>
        ) : (
          <DeviceGrid
            devices={visibleDevices}
            layout={layout}
            onDeviceClick={handleDeviceClick}
          />
        )}
      </div>
      
      {/* 하단 상태 바 */}
      <StatusBar
        total={devices.length}
        online={devices.filter(d => d.status === 'ONLINE').length}
        layout={layout}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

