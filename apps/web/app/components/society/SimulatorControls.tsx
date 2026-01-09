// components/society/SimulatorControls.tsx
// 시뮬레이터 제어 패널 - 수동 활동 생성 + 웜홀 트리거

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface SimulatorControlsProps {
  onActivityGenerated?: () => void;
}

export function SimulatorControls({ onActivityGenerated }: SimulatorControlsProps) {
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(2000);
  const [activitiesPerTick, setActivitiesPerTick] = useState(5);
  const [lastResult, setLastResult] = useState<{ generated: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wormholeLoading, setWormholeLoading] = useState(false);
  
  // 단일 틱 실행
  const runTick = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: activitiesPerTick }),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }
      
      const data = await response.json();
      setLastResult(data);
      onActivityGenerated?.();
    } catch (error) {
      console.error('[SimulatorControls] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activitiesPerTick, onActivityGenerated]);
  
  // 자동 실행
  useEffect(() => {
    if (!isAutoRunning) return;
    
    const interval = setInterval(runTick, intervalMs);
    return () => clearInterval(interval);
  }, [isAutoRunning, intervalMs, runTick]);
  
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-purple-500">⚙️</span>
        <span className="font-mono text-sm text-neutral-300">SIMULATOR CONTROLS</span>
      </div>
      
      {/* Auto Run Toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-neutral-400 text-sm">자동 실행</span>
        <button
          onClick={() => setIsAutoRunning(!isAutoRunning)}
          className={`px-4 py-2 font-mono text-sm rounded transition-colors ${
            isAutoRunning
              ? 'bg-emerald-600 text-white'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          {isAutoRunning ? '⏸️ 중지' : '▶️ 시작'}
        </button>
      </div>
      
      {/* Interval Slider */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>간격</span>
          <span>{(intervalMs / 1000).toFixed(1)}초</span>
        </div>
        <input
          type="range"
          min="500"
          max="5000"
          step="500"
          value={intervalMs}
          onChange={(e) => setIntervalMs(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* Activities Per Tick */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>틱당 활동 수</span>
          <span>{activitiesPerTick}</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          value={activitiesPerTick}
          onChange={(e) => setActivitiesPerTick(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* Manual Trigger */}
      <button
        onClick={runTick}
        disabled={isLoading}
        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 text-white font-mono text-sm rounded transition-colors"
      >
        {isLoading ? '⏳ 생성 중...' : '⚡ 수동 실행'}
      </button>
      
      {/* Last Result */}
      {lastResult && (
        <motion.div
          className="mt-3 text-center text-xs text-neutral-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          마지막 실행: {lastResult.generated}개 활동 생성
        </motion.div>
      )}
      
      {/* Divider */}
      <div className="my-4 border-t border-neutral-800" />
      
      {/* Wormhole Trigger */}
      <div className="space-y-2">
        <p className="text-neutral-400 text-xs font-mono">🕳️ WORMHOLE</p>
        <button
          onClick={async () => {
            setWormholeLoading(true);
            try {
              const response = await fetch('/api/wormhole', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes: 3 }),
              });

              if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
              }

              const data = await response.json();
              if (data.success) {
                console.log('[Wormhole]', data.message);
              }
            } catch (error) {
              console.error('[Wormhole] Error:', error);
            } finally {
              setWormholeLoading(false);
            }
          }}
          disabled={wormholeLoading}
          className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 text-white font-mono text-sm rounded transition-colors"
        >
          {wormholeLoading ? '⏳ 탐지 중...' : '🕳️ 웜홀 생성'}
        </button>
        <p className="text-neutral-600 text-xs text-center">
          집단 동기화 시뮬레이션
        </p>
      </div>
      
      {/* Status Indicator */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isAutoRunning ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
        <span className="text-xs text-neutral-500">
          {isAutoRunning ? 'Auto-running' : 'Stopped'}
        </span>
      </div>
    </div>
  );
}

