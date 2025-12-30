/**
 * Dashboard Page
 * 디바이스 그리드 뷰 + 빈 상태 / 에러 처리
 * 
 * @author Axon (Tech Lead)
 * @version 2.2.0
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useDevices } from '../hooks/useDevices';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGridLayout } from '../hooks/useGridLayout';
import { DeviceGrid } from '../components/DeviceGrid';
import { GlobalActionBar } from '../components/GlobalActionBar';
import { StatusBar } from '../components/StatusBar';

export default function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // 디바이스 목록 (SWR)
  const { 
    devices, 
    onlineCount,
    isLoading, 
    isValidating,
    error, 
    refresh 
  } = useDevices();
  
  // WebSocket 연결
  const { isConnected, sendMessage, reconnect } = useWebSocket({
    onDevicesUpdate: () => {
      // WebSocket에서 디바이스 업데이트 알림 받으면 SWR 갱신
      refresh();
    }
  });
  
  // 그리드 레이아웃 계산
  const layout = useGridLayout(containerRef, devices.length);
  
  // 현재 페이지에 표시할 디바이스
  const visibleDevices = devices.slice(
    currentPage * layout.pagination.devicesPerPage,
    (currentPage + 1) * layout.pagination.devicesPerPage
  );
  
  // 페이지 범위 초과 시 리셋
  useEffect(() => {
    if (currentPage > 0 && visibleDevices.length === 0) {
      setCurrentPage(0);
    }
  }, [currentPage, visibleDevices.length]);
  
  // 디바이스 스캔
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await fetch('/api/discovery/scan', { method: 'POST' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `스캔 실패 (HTTP ${response.status})`);
      }
      await refresh();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다';
      console.error('Scan failed:', e);
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  }, [refresh]);
  
  // 글로벌 액션 핸들러
  const handleGlobalAction = useCallback((action: { type: string; [key: string]: unknown }) => {
    switch (action.type) {
      case 'RESCAN':
        handleScan();
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
  }, [handleScan, sendMessage]);
  
  // 디바이스 선택 핸들러
  const handleDeviceClick = useCallback((deviceId: string) => {
    window.location.href = `/device/${encodeURIComponent(deviceId)}`;
  }, []);
  
  return (
    <div className="flex flex-col h-screen bg-room-900">
      {/* 상단 액션 바 */}
      <GlobalActionBar
        deviceCount={devices.length}
        onlineCount={onlineCount}
        isConnected={isConnected}
        onAction={handleGlobalAction}
      />
      
      {/* 메인 그리드 영역 */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {/* 로딩 상태 */}
        {isLoading && <LoadingState />}
        
        {/* 에러 상태 */}
        {!isLoading && error && (
          <ErrorState 
            error={error} 
            onRetry={refresh}
            onReconnect={reconnect}
            isConnected={isConnected}
          />
        )}
        
        {/* 빈 상태 */}
        {!isLoading && !error && devices.length === 0 && (
          <EmptyState 
            onScan={handleScan}
            isScanning={isScanning}
            scanError={scanError}
          />
        )}
        
        {/* 디바이스 그리드 */}
        {!isLoading && !error && devices.length > 0 && (
          <DeviceGrid
            devices={visibleDevices}
            layout={layout}
            onDeviceClick={handleDeviceClick}
          />
        )}
        
        {/* 백그라운드 업데이트 인디케이터 */}
        {isValidating && !isLoading && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-room-800/80 px-2 py-1 rounded text-xs text-gray-400">
            <span className="w-2 h-2 bg-doai-400 rounded-full animate-pulse"></span>
            업데이트 중...
          </div>
        )}
      </div>
      
      {/* 하단 상태 바 */}
      <StatusBar
        total={devices.length}
        online={onlineCount}
        layout={layout}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

/**
 * 로딩 상태 컴포넌트
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-room-600 border-t-doai-400 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">📱</span>
        </div>
      </div>
      <div className="text-gray-400 text-lg">디바이스 로딩 중...</div>
    </div>
  );
}

/**
 * 에러 상태 컴포넌트
 */
interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
  onReconnect: () => void;
  isConnected: boolean;
}

function ErrorState({ error, onRetry, onReconnect, isConnected }: ErrorStateProps) {
  const isNetworkError = error.message.includes('fetch') || 
                         error.message.includes('network') ||
                         error.message.includes('abort');
  
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="text-6xl">
        {isNetworkError ? '🔌' : '⚠️'}
      </div>
      
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-white mb-2">
          {isNetworkError ? '연결 끊김' : '오류 발생'}
        </h2>
        <p className="text-gray-400 mb-4">
          {isNetworkError 
            ? '서버와의 연결이 끊어졌습니다. 네트워크 상태를 확인해주세요.'
            : error.message}
        </p>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="btn-doai"
        >
          🔄 다시 시도
        </button>
        
        {!isConnected && (
          <button
            onClick={onReconnect}
            className="px-4 py-2 bg-room-600 hover:bg-room-500 text-white rounded-lg transition-colors"
          >
            📡 재연결
          </button>
        )}
      </div>
      
      {/* 기술적 상세 정보 (접을 수 있음) */}
      <details className="mt-4 text-sm text-gray-500">
        <summary className="cursor-pointer hover:text-gray-400">기술적 상세</summary>
        <pre className="mt-2 p-3 bg-room-800 rounded text-xs overflow-auto max-w-lg">
          {error.stack || error.message}
        </pre>
      </details>
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
interface EmptyStateProps {
  onScan: () => void;
  isScanning: boolean;
  scanError?: string | null;
}

function EmptyState({ onScan, isScanning, scanError }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="relative">
        <div className="text-8xl opacity-50">📵</div>
        {/* 파동 효과 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 border-2 border-room-500 rounded-full animate-ping opacity-30"></div>
        </div>
      </div>
      
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-white mb-2">
          디바이스가 없습니다
        </h2>
        <p className="text-gray-400">
          연결된 Android 디바이스를 찾을 수 없습니다.<br/>
          USB로 연결하거나 WiFi ADB를 활성화해주세요.
        </p>
      </div>
      
      {/* 스캔 에러 표시 */}
      {scanError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm max-w-md">
          <span>⚠️</span>
          <span>{scanError}</span>
        </div>
      )}
      
      <button
        onClick={onScan}
        disabled={isScanning}
        className={`btn-doai flex items-center gap-2 ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isScanning ? (
          <>
            <span className="w-4 h-4 border-2 border-room-900 border-t-transparent rounded-full animate-spin"></span>
            스캔 중...
          </>
        ) : (
          <>
            🔍 디바이스 스캔
          </>
        )}
      </button>
      
      {/* 연결 가이드 */}
      <div className="mt-6 p-4 bg-room-800/50 rounded-lg border border-room-600 max-w-lg">
        <h3 className="text-sm font-semibold text-doai-400 mb-3">📋 연결 가이드</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-green-400">USB:</span>
            <span>디바이스를 USB로 연결하고 개발자 옵션에서 USB 디버깅을 활성화하세요.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400">WiFi:</span>
            <span>
              <code className="bg-room-700 px-1 rounded">adb tcpip 5555</code> 실행 후
              <code className="bg-room-700 px-1 rounded ml-1">adb connect IP:5555</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
