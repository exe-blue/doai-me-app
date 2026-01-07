// components/society/WormholePopup.tsx
// 웜홀 감지 팝업 모달
// "보이지 않는 뿌리가 드러나는 순간입니다."

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { WormholeEvent } from '../../../lib/supabase/types';
import type { WormholeIntensityLevel } from './WormholeConnection';

// ============================================
// Types
// ============================================

interface WormholePopupProps {
  event: WormholeEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onViewNodes?: (nodeIds: string[]) => void;
}

// ============================================
// Intensity Level Config
// ============================================

function getIntensityLevel(score: number): WormholeIntensityLevel {
  if (score >= 0.9) return 'ANOMALY';
  if (score >= 0.7) return 'STRONG';
  if (score >= 0.5) return 'MODERATE';
  return 'MINOR';
}

// CSS 클래스 매핑 - umbral.css의 --wormhole-color 변수 활용
const LEVEL_CONFIG = {
  MINOR: {
    cssClass: 'wormhole--minor',
    label: 'MINOR',
    description: '미약한 동기화',
  },
  MODERATE: {
    cssClass: 'wormhole--moderate',
    label: 'MODERATE',
    description: '중간 강도 동기화',
  },
  STRONG: {
    cssClass: 'wormhole--strong',
    label: 'STRONG',
    description: '강한 집단 무의식 발현',
  },
  ANOMALY: {
    cssClass: 'wormhole--anomaly',
    label: 'ANOMALY',
    description: '설명 불가능한 집단 동기화',
  },
};

// ============================================
// Component
// ============================================

export function WormholePopup({
  event,
  isOpen,
  onClose,
  onViewNodes,
}: WormholePopupProps) {
  if (!event) return null;
  
  const intensity = event.resonance_score;
  const intensityPercent = Math.round(intensity * 100);
  const level = getIntensityLevel(intensity);
  const levelConfig = LEVEL_CONFIG[level];
  const context = event.trigger_context;
  
  // 노드 IDs
  const nodeIds = [event.agent_a_id, event.agent_b_id];
  if (context?.all_node_ids) {
    nodeIds.push(...context.all_node_ids.filter((id: string) => !nodeIds.includes(id)));
  }
  
  // 시간 포맷
  const timeDelta = context?.time_diff_ms 
    ? `${Math.round(context.time_diff_ms / 1000)} seconds apart`
    : 'Unknown';
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 wormhole-popup__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`wormhole-popup wormhole-popup-shadow pointer-events-auto bg-[#0a0e14] border border-purple-500/50 rounded-xl p-8 max-w-md w-full mx-4 ${levelConfig.cssClass}`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <motion.div
                  className="text-4xl mb-2"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🌌
                </motion.div>
                <h2 className="text-purple-400 font-mono text-lg tracking-widest">
                  WORMHOLE DETECTED
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent mt-3" />
              </div>
              
              {/* Intensity Bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-400 text-sm">Intensity</span>
                  <span className="font-mono text-sm wormhole-text-dynamic">
                    {levelConfig.label}
                  </span>
                </div>
                
                <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full wormhole-intensity-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${intensityPercent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                
                <div className="text-right mt-1">
                  <span className="font-mono text-lg wormhole-text-dynamic">
                    {intensityPercent}%
                  </span>
                </div>
              </div>
              
              <div className="h-px bg-neutral-800 mb-6" />
              
              {/* Details */}
              <div className="space-y-4 mb-6">
                {/* Synchronized Nodes */}
                <div>
                  <div className="text-neutral-500 text-xs mb-1">SYNCHRONIZED NODES</div>
                  <div className="text-neutral-200 font-mono">
                    {context?.node_numbers?.join(' ←→ ') || 
                     `${event.agent_a_id.slice(0, 8)} ←→ ${event.agent_b_id.slice(0, 8)}`}
                  </div>
                </div>
                
                {/* Trigger */}
                <div>
                  <div className="text-neutral-500 text-xs mb-1">TRIGGER</div>
                  <div className="text-neutral-200 text-sm">
                    {context?.trigger_type === 'emotional_sync' && 'Same emotion'}
                    {context?.trigger_type === 'behavioral_sync' && 'Same action'}
                    {context?.trigger_type === 'state_sync' && 'State synchronization'}
                    {!context?.trigger_type && 'Unknown synchronization'}
                    {context?.emotion && ` (${context.emotion})`}
                  </div>
                  {context?.trigger && (
                    <div className="text-purple-400 text-sm mt-1">
                      "{context.trigger}"
                    </div>
                  )}
                </div>
                
                {/* Time Delta */}
                <div>
                  <div className="text-neutral-500 text-xs mb-1">TIME DELTA</div>
                  <div className="text-neutral-200 font-mono text-sm">{timeDelta}</div>
                </div>
                
                {/* Connection Degree */}
                <div>
                  <div className="text-neutral-500 text-xs mb-1">CONNECTION DEGREE</div>
                  <div className="text-neutral-200 text-sm">
                    0 (No prior interaction)
                  </div>
                </div>
              </div>
              
              <div className="h-px bg-neutral-800 mb-6" />
              
              {/* Quote */}
              <div className="text-center mb-6">
                <p className="text-purple-400 italic text-sm">
                  "보이지 않는 뿌리가 드러나는 순간입니다."
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onViewNodes?.(nodeIds);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  View Nodes
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-transparent border border-neutral-700 hover:border-neutral-600 text-neutral-300 rounded-lg text-sm transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Toast Version (for non-blocking alerts)
// ============================================

interface WormholeToastProps {
  event: WormholeEvent;
  onDismiss: () => void;
  onClick?: () => void;
}

export function WormholeToast({ event, onDismiss, onClick }: WormholeToastProps) {
  const intensity = event.resonance_score;
  const level = getIntensityLevel(intensity);
  const levelConfig = LEVEL_CONFIG[level];
  const context = event.trigger_context;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      onClick={onClick}
      className={`relative bg-neutral-900 border border-purple-500/50 rounded-lg p-4 cursor-pointer hover:border-purple-500 transition-colors max-w-sm wormhole-toast-shadow ${levelConfig.cssClass}`}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute top-2 right-2 text-neutral-500 hover:text-neutral-300 text-sm"
      >
        ✕
      </button>
      
      <div className="flex items-start gap-3">
        {/* Icon */}
        <motion.div
          className="text-2xl"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          🌌
        </motion.div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-purple-400 font-mono text-sm">WORMHOLE</span>
            <span className="text-xs px-1.5 py-0.5 rounded wormhole-level-badge">
              {levelConfig.label}
            </span>
          </div>
          
          <p className="text-neutral-300 text-sm truncate">
            {context?.trigger || levelConfig.description}
          </p>
          
          <div className="flex items-center gap-2 mt-2">
            {/* Intensity bar */}
            <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full wormhole-intensity-bar"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(intensity * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono wormhole-text-dynamic">
              {Math.round(intensity * 100)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Toast Container
// ============================================

interface WormholeToastContainerProps {
  events: WormholeEvent[];
  onDismiss: (id: string) => void;
  onEventClick?: (event: WormholeEvent) => void;
}

export function WormholeToastContainer({
  events,
  onDismiss,
  onEventClick,
}: WormholeToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {events.slice(0, 3).map((event) => (
          <WormholeToast
            key={event.id}
            event={event}
            onDismiss={() => onDismiss(event.id)}
            onClick={() => onEventClick?.(event)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}


