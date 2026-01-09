/**
 * Dashboard Page - Production Version
 * 
 * 실제 Gateway API 연동
 * - 디바이스 실시간 스캔 & 목록 표시
 * - 클릭하면 아래로 펼쳐지는 스트림 뷰
 * 
 * @author Axon (Tech Lead)
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceStore, useFilteredDevices } from '@/stores/deviceStore';
import { useWebSocketStore } from '@/stores/websocketStore';
import { ExpandableDeviceCard, FilterBar, type FilterState } from '@/components/organisms';
import { Button, Card } from '@/components/atoms';

export default function DashboardPage() {
  const navigate = useNavigate();
  
  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Device Store
  const { 
    count,
    expandedDeviceId,
    isLoading, 
    isScanning,
    error,
    filters,
    sortBy,
    fetchDevices,
    scanDevices,
    toggleExpandDevice,
    setFilters,
    setSortBy,
  } = useDeviceStore();
  
  // WebSocket Store
  const { isConnected, connect } = useWebSocketStore();
  
  // 필터링된 디바이스 목록
  const filteredDevices = useFilteredDevices();

  // 초기화: API 호출 & WebSocket 연결
  useEffect(() => {
    fetchDevices();
    connect();
  }, [fetchDevices, connect]);

  // 통계 계산
  const stats = useMemo(() => ({
    online: count?.online || 0,
    offline: count?.offline || 0,
    busy: 0, // API에서 제공되지 않으면 0
    idle: 0,
  }), [count]);

  // 필터 핸들러
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters({
      status: newFilters.status,
      activity: newFilters.activity,
      connectionType: newFilters.connection,
      searchTerm: newFilters.search,
    });
    setSortBy(newFilters.sortBy);
  }, [setFilters, setSortBy]);

  // FilterBar용 필터 상태 변환
  const filterBarState: FilterState = useMemo(() => ({
    status: filters.status,
    activity: filters.activity,
    existence: [],
    connection: filters.connectionType,
    search: filters.searchTerm,
    sortBy: sortBy,
  }), [filters, sortBy]);

  // 뷰 모드 변경 핸들러
  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
  }, []);

  // 디바이스 확장 토글
  const handleToggleExpand = useCallback((deviceId: string) => {
    toggleExpandDevice(deviceId);
  }, [toggleExpandDevice]);

  // 상세 페이지 이동
  const handleSelectDevice = useCallback((deviceId: string) => {
    navigate(`/device/${deviceId}`);
  }, [navigate]);

  // 스캔 버튼 핸들러
  const handleScan = useCallback(async () => {
    await scanDevices();
  }, [scanDevices]);

  return (
    <div className="h-full flex flex-col">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-void-700">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">HIVE</h1>
          <p className="text-sm text-void-400">
            {count ? `${count.total} devices registered` : 'Loading...'}
            {!isConnected && <span className="text-red-400 ml-2">• WebSocket Disconnected</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? '⏳ Scanning...' : '🔍 Scan Devices'}
          </Button>
          
          {count && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-status-online">● {count.online}</span>
              <span className="text-status-offline">○ {count.offline}</span>
              {count.byType && (
                <>
                  <span className="text-void-500">|</span>
                  <span className="text-connection-usb">USB: {count.byType.USB || 0}</span>
                  <span className="text-connection-wifi">WiFi: {count.byType.WIFI || 0}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filterBarState}
        onFiltersChange={handleFiltersChange}
        stats={stats}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-void-400">
            <div className="animate-spin w-12 h-12 border-4 border-doai-yellow-500 border-t-transparent rounded-full mb-4" />
            <p>디바이스 목록을 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-red-400 text-lg mb-4">⚠️ {error}</p>
            <Button variant="secondary" onClick={() => fetchDevices()}>
              다시 시도
            </Button>
          </Card>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && filteredDevices.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-void-400">
            <span className="text-6xl mb-4">📵</span>
            <p className="text-lg mb-2">연결된 디바이스가 없습니다</p>
            <p className="text-sm mb-4">USB 또는 WiFi로 디바이스를 연결하세요</p>
            <Button variant="primary" onClick={handleScan} disabled={isScanning}>
              {isScanning ? 'Scanning...' : 'Scan for Devices'}
            </Button>
          </div>
        )}

        {/* 디바이스 목록 - Expandable Cards */}
        {!isLoading && !error && filteredDevices.length > 0 && (
          <div className="space-y-3">
            {filteredDevices.map((device) => (
              <ExpandableDeviceCard
                key={device.serial}
                device={device}
                isExpanded={expandedDeviceId === device.serial}
                onToggleExpand={handleToggleExpand}
                onSelect={handleSelectDevice}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-void-800 border-t border-void-700 flex items-center justify-between text-sm text-void-400">
        <span>
          {filteredDevices.length} / {count?.total || 0} devices shown
          {expandedDeviceId && ` • Viewing: ${expandedDeviceId.slice(-8)}`}
        </span>
        <div className="flex items-center gap-4">
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '● WebSocket Connected' : '○ WebSocket Disconnected'}
          </span>
          <span className="text-xs">
            Click device to view stream
          </span>
        </div>
      </div>
    </div>
  );
}
