/**
 * DeviceDetail Page
 * 단일 디바이스 상세 뷰
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  
  const { data, error, isLoading } = useSWR(
    deviceId ? `/api/devices/${encodeURIComponent(deviceId)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-gray-400 text-lg">🔄 Loading device...</div>
      </div>
    );
  }
  
  if (error || !data?.success) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 gap-4">
        <div className="text-red-400 text-lg">❌ Device not found</div>
        <Link to="/" className="text-blue-400 hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }
  
  const device = data.device;
  
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-white">
            {device.aiCitizen?.name || device.serial}
          </h1>
          <span className={`px-2 py-1 rounded text-xs ${
            device.status === 'ONLINE' ? 'bg-green-600' : 'bg-gray-600'
          }`}>
            {device.status}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{device.model}</span>
          <span>|</span>
          <span>Android {device.androidVersion}</span>
          <span>|</span>
          <span>{device.connectionType}</span>
        </div>
      </div>
      
      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 비디오 스트림 */}
        <div className="flex-1 bg-black flex items-center justify-center">
          {device.status === 'ONLINE' ? (
            <iframe
              src={`/stream/${encodeURIComponent(device.serial)}/view?quality=high&touchable=true`}
              className="w-full h-full border-0"
              title="Device Stream"
            />
          ) : (
            <div className="text-gray-500 text-6xl">📵</div>
          )}
        </div>
        
        {/* 오른쪽: 정보 패널 */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          {/* AI 시민 정보 */}
          {device.aiCitizen && (
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-2">🎭 AI Citizen</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name</span>
                  <span className="text-white">{device.aiCitizen.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">State</span>
                  <span className="text-white">{device.aiCitizen.existence_state}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* 메트릭 */}
          {device.metrics && (
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-2">📊 Metrics</h2>
              <div className="space-y-2">
                <MetricBar 
                  label="Existence" 
                  value={device.metrics.existence_score ?? 0.5} 
                  color="green"
                />
                <MetricBar 
                  label="Priority" 
                  value={device.metrics.priority ?? 0.5} 
                  color="blue"
                />
                <MetricBar 
                  label="Uniqueness" 
                  value={device.metrics.uniqueness ?? 0.5} 
                  color="purple"
                />
                <MetricBar 
                  label="Corruption" 
                  value={device.metrics.corruption ?? 0} 
                  color="red"
                />
              </div>
            </div>
          )}
          
          {/* 제어 버튼 */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-2">🎮 Control</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sendControl('KEYCODE_BACK')}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                ◀ Back
              </button>
              <button
                onClick={() => sendControl('KEYCODE_HOME')}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                🏠 Home
              </button>
              <button
                onClick={() => sendControl('KEYCODE_APP_SWITCH')}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                ⬛ Recent
              </button>
              <button
                onClick={() => restartAutoX()}
                className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm"
              >
                🔄 AutoX
              </button>
            </div>
          </div>
          
          {/* 연결 정보 */}
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-2">🔌 Connection</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Serial</span>
                <span className="text-white font-mono text-xs">{device.serial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span>
                <span className="text-white">{device.connectionType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gateway Client</span>
                <span className={device.gatewayClientConnected ? 'text-green-400' : 'text-gray-500'}>
                  {device.gatewayClientConnected ? '🔗 Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Seen</span>
                <span className="text-white text-xs">
                  {new Date(device.lastSeenAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  
  function sendControl(keycode: string) {
    fetch(`/api/control/${encodeURIComponent(device.serial)}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keycode })
    });
  }
  
  function restartAutoX() {
    fetch(`/api/control/${encodeURIComponent(device.serial)}/restart-autox`, {
      method: 'POST'
    });
  }
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500'
  };
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded overflow-hidden">
        <div 
          className={`h-full ${colors[color as keyof typeof colors]}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

