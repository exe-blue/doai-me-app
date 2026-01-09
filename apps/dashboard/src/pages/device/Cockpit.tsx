/**
 * Device Cockpit Page - 단일 디바이스 상세 관제
 * 스트리밍 + 로그 + 제어
 */
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { StreamView } from '@/components/organisms/StreamView';
import { useDeviceStore } from '@/stores/deviceStore';
import { sendKey, getScreenshot } from '@/services/api';

export default function DeviceCockpitPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const device = useDeviceStore((state) => 
    state.devices.find((d) => d.serial === deviceId)
  );
  const [isStreaming, setIsStreaming] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // 스크린샷 촬영
  const handleScreenshot = async () => {
    if (!deviceId) return;
    try {
      const url = await getScreenshot(deviceId);
      setScreenshotUrl(url);
      // 3초 후 URL 해제
      setTimeout(() => {
        if (url) URL.revokeObjectURL(url);
        setScreenshotUrl(null);
      }, 5000);
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  };

  // 키 입력 전송
  const handleKey = async (keycode: number) => {
    if (!deviceId) return;
    try {
      await sendKey(deviceId, keycode);
    } catch (e) {
      console.error('Key failed:', e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-doai-black-800 border-b border-doai-black-700 flex items-center gap-4">
        <Link to="/dashboard" className="btn-ghost py-1.5 px-3 text-sm">
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${device?.status === 'ONLINE' ? 'bg-status-online' : 'bg-status-offline'}`} />
          <h1 className="font-display font-bold text-lg">
            {device?.model || 'Unknown'} ({deviceId?.split(':')[0] || deviceId})
          </h1>
        </div>
        <span className={`ml-auto px-2 py-1 rounded text-xs ${device?.status === 'ONLINE' ? 'bg-green-600' : 'bg-red-600'}`}>
          {device?.status || 'UNKNOWN'}
        </span>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-auto">
        {/* Stream Panel */}
        <div className="card p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span>📺</span>
              <span>STREAM</span>
            </h2>
            <button 
              onClick={() => setIsStreaming(!isStreaming)}
              className={`text-xs px-2 py-1 rounded ${isStreaming ? 'bg-green-600' : 'bg-gray-600'}`}
            >
              {isStreaming ? '🔴 LIVE' : '⏸ PAUSED'}
            </button>
          </div>
          
          {/* 실시간 스트림 또는 스크린샷 */}
          {deviceId && (
            <StreamView 
              deviceId={deviceId}
              isExpanded={isStreaming}
              className="min-h-[400px]"
            />
          )}
          
          {/* 스크린샷 미리보기 */}
          {screenshotUrl && (
            <div className="mt-2 p-2 bg-doai-black-900 rounded-lg">
              <img src={screenshotUrl} alt="Screenshot" className="w-full rounded" />
            </div>
          )}

          {/* Stream Controls */}
          <div className="flex items-center gap-2 mt-4">
            <button 
              onClick={handleScreenshot}
              className="btn-ghost flex-1 text-sm"
            >
              📷 Screenshot
            </button>
            <button 
              onClick={() => handleKey(3)}
              className="btn-ghost flex-1 text-sm"
              title="Home"
            >
              🏠 Home
            </button>
            <button 
              onClick={() => handleKey(4)}
              className="btn-ghost flex-1 text-sm"
              title="Back"
            >
              ← Back
            </button>
          </div>

          {/* Activity Indicator */}
          <div className="mt-4 p-3 rounded-lg bg-activity-mining/20 border border-activity-mining/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎭</span>
              <span className="font-medium text-activity-mining">MINING</span>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-doai-black-700 rounded-full overflow-hidden">
                <div className="h-full w-[45%] bg-activity-mining rounded-full" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Progress: 45%</p>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="card p-4 lg:col-span-1 flex flex-col gap-4">
          <h2 className="font-semibold flex items-center gap-2">
            <span>👤</span>
            <span>INFO</span>
          </h2>

          {/* Identity */}
          <div className="p-4 bg-doai-black-700 rounded-lg text-center">
            <div className="w-16 h-16 rounded-full bg-doai-black-600 mx-auto mb-3 flex items-center justify-center text-3xl">
              🤖
            </div>
            <h3 className="font-display font-bold text-lg">{deviceId}</h3>
            <p className="text-xs text-gray-500 mt-1">AI Citizen #047</p>
          </div>

          {/* Big Five Traits */}
          <div className="space-y-2">
            <h4 className="text-sm text-gray-400">Traits (Big Five)</h4>
            {['O', 'C', 'E', 'A', 'N'].map((trait, i) => (
              <div key={trait} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-gray-500">{trait}:</span>
                <div className="flex-1 h-1.5 bg-doai-black-700 rounded-full">
                  <div 
                    className="h-full bg-doai-yellow-500 rounded-full"
                    style={{ width: `${[72, 45, 81, 63, 34][i]}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-gray-500">{[0.72, 0.45, 0.81, 0.63, 0.34][i]}</span>
              </div>
            ))}
          </div>

          {/* Status Info */}
          <div className="space-y-2 pt-4 border-t border-doai-black-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">🔋 Battery</span>
              <span>87%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📡 Connection</span>
              <span className="text-connection-usb">USB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">⏱ Last Sync</span>
              <span>2s ago</span>
            </div>
          </div>

          {/* Economy */}
          <div className="space-y-2 pt-4 border-t border-doai-black-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">💰 Credits</span>
              <span className="text-doai-yellow-500 font-semibold">2,450 CR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📊 Existence</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-doai-black-700 rounded-full">
                  <div className="h-full w-[72%] bg-existence-high rounded-full" />
                </div>
                <span>0.72</span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">🏆 Rank</span>
              <span>#47</span>
            </div>
          </div>

          {/* View Memories Button */}
          <button className="btn-secondary w-full mt-auto">
            View Memories →
          </button>
        </div>

        {/* Logs + Controls Panel */}
        <div className="card p-4 lg:col-span-1 flex flex-col">
          {/* Controls */}
          <div className="mb-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>🎮</span>
              <span>CONTROLS</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary text-sm">⏸ PAUSE</button>
              <button className="btn-secondary text-sm">🔄 SYNC</button>
              <button className="btn-secondary text-sm">📋 REASSIGN</button>
              <button className="btn-secondary text-sm">🔃 RESTART</button>
            </div>
            <button className="btn-danger w-full mt-2 text-sm">⚠️ REBOOT</button>
          </div>

          {/* Logs */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <span>📜</span>
                <span>LOGS</span>
              </h2>
              <div className="flex gap-1 text-xs">
                <button className="px-2 py-1 rounded bg-doai-black-700">ALL</button>
                <button className="px-2 py-1 rounded hover:bg-doai-black-700">WS</button>
                <button className="px-2 py-1 rounded hover:bg-doai-black-700">ERR</button>
              </div>
            </div>

            {/* Log Lines */}
            <div className="flex-1 overflow-auto bg-doai-black-900 rounded-lg p-3 font-mono text-xs space-y-1">
              {[
                { time: '14:32:01', type: 'WS', msg: '← HEARTBEAT' },
                { time: '14:32:00', type: 'TASK', msg: '▶ MINING started' },
                { time: '14:31:58', type: 'WS', msg: '→ STATUS_UPDATE' },
                { time: '14:31:55', type: 'TASK', msg: 'Video loaded' },
                { time: '14:31:50', type: 'WS', msg: '← MINING_WATCH' },
                { time: '14:31:45', type: 'TASK', msg: 'Selecting video...' },
                { time: '14:31:40', type: 'WS', msg: '→ HEARTBEAT' },
              ].map((log, i) => (
                <div key={i} className={`${log.type === 'WS' ? 'text-activity-surfing' : 'text-gray-400'}`}>
                  <span className="text-gray-600">{log.time}</span>{' '}
                  <span className="text-gray-500">[{log.type}]</span>{' '}
                  {log.msg}
                </div>
              ))}
            </div>

            {/* Log Actions */}
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost text-xs flex-1">Export Logs</button>
              <button className="btn-ghost text-xs flex-1">Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

