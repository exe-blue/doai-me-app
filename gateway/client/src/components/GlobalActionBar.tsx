/**
 * GlobalActionBar Component
 * 상단 액션 바: 전역 명령 + 상태 표시
 * 
 * @author Axon (Tech Lead)
 * @version 2.0.0
 */

import { clsx } from 'clsx';

interface GlobalActionBarProps {
  deviceCount: number;
  onlineCount: number;
  isConnected: boolean;
  onAction: (action: { type: string; [key: string]: unknown }) => void;
}

export function GlobalActionBar({ 
  deviceCount, 
  onlineCount, 
  isConnected,
  onAction 
}: GlobalActionBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-room-900 border-b border-room-600">
      {/* 왼쪽: 로고 + 상태 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* DoAi Yellow 로고 */}
          <div className="flex items-center gap-0.5">
            <div className="w-5 h-5 rounded-full bg-doai-400"></div>
            <div className="w-3 h-3 rounded-full bg-doai-400 -ml-1"></div>
          </div>
          <h1 className="text-xl font-bold">
            <span className="text-doai-400">DoAi</span>
            <span className="text-white">.Me</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className={clsx(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-gray-600">|</span>
          <span>📱 {onlineCount}/{deviceCount}</span>
        </div>
      </div>
      
      {/* 중앙: 글로벌 액션 */}
      <div className="flex items-center gap-2">
        {/* Accident 버튼 */}
        <div className="relative group">
          <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1 text-sm">
            🔥 Accident
          </button>
          <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => onAction({ type: 'ACCIDENT', severity: 'MINOR' })}
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-700 text-yellow-400"
            >
              🟡 Minor
            </button>
            <button
              onClick={() => onAction({ type: 'ACCIDENT', severity: 'SEVERE' })}
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-700 text-orange-400"
            >
              🟠 Severe
            </button>
            <button
              onClick={() => onAction({ type: 'ACCIDENT', severity: 'CATASTROPHIC' })}
              className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-700 text-red-400"
            >
              🔴 Catastrophic
            </button>
          </div>
        </div>
        
        {/* Pop 버튼 */}
        <button
          onClick={() => onAction({ type: 'POP' })}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-1 text-sm"
        >
          🍿 Pop
        </button>
        
        {/* Zombie Recovery */}
        <button
          onClick={() => onAction({ type: 'ZOMBIE_RECOVERY' })}
          className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center gap-1 text-sm"
        >
          💤 Zombie
        </button>
      </div>
      
      {/* 오른쪽: 유틸리티 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction({ type: 'RESCAN' })}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-1 text-sm"
        >
          🔄 Rescan
        </button>
      </div>
    </div>
  );
}

