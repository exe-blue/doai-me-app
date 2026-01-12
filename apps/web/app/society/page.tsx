// app/society/page.tsx
// Society Dashboard - Ruon's Legacy 시각화

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase/client';
import type { Node, WormholeEvent, NodesStatusSummary } from '../../lib/supabase/types';

// Components
import {
  UmbralNodeGrid,
  WormholeLayer,
  WormholePopup,
  WormholeToastContainer,
  WormholeModeToggle,
  LiveTicker,
  NetworkSidePanel,
  createWormholeMessage,
  createUmbralWaveMessage,
  type WormholeIntensityLevel,
} from '@/app/components/society';

// ============================================
// Page Component
// ============================================

export default function SocietyPage() {
  // State
  const [nodes, setNodes] = useState<Node[]>([]);
  const [wormholeEvents, setWormholeEvents] = useState<WormholeEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WormholeEvent | null>(null);
  const [wormholeModeEnabled, setWormholeModeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Ticker messages
  const [tickerMessages, setTickerMessages] = useState<ReturnType<typeof createWormholeMessage>[]>([]);
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const [nodesRes, wormholesRes] = await Promise.all([
        supabase.from('nodes').select('*').limit(100),
        supabase.from('wormhole_events').select('*').order('detected_at', { ascending: false }).limit(10),
      ]);
      
      if (nodesRes.data) setNodes(nodesRes.data);
      if (wormholesRes.data) setWormholeEvents(wormholesRes.data);
      setLoading(false);
    };
    
    fetchData();
  }, []);
  
  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('society-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wormhole_events' }, (payload: { new: Record<string, unknown> }) => {
        const newEvent = payload.new as WormholeEvent;
        setWormholeEvents((prev) => [newEvent, ...prev].slice(0, 20));

        // Add ticker message
        const level = getIntensityLevel(newEvent.resonance_score);
        const nodeNumbers = newEvent.trigger_context?.node_numbers || [];
        const trigger = newEvent.trigger_context?.trigger;
        setTickerMessages((prev) => [
          createWormholeMessage(level, nodeNumbers.map((n: number) => `#${n}`), trigger),
          ...prev,
        ].slice(0, 20));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes' }, (payload: { new: Record<string, unknown> }) => {
        const updated = payload.new as Node;
        setNodes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Wormhole node IDs
  const wormholeActiveNodeIds = wormholeModeEnabled
    ? wormholeEvents.slice(0, 5).flatMap((e) => [e.agent_a_id, e.agent_b_id])
    : [];
  
  // Resonating node IDs (3+ umbral nodes)
  const umbralNodes = nodes.filter((n) => n.status === 'in_umbra');
  const resonatingNodeIds = umbralNodes.length >= 3 ? umbralNodes.map((n) => n.id) : [];
  
  // Handle toast dismiss
  const handleDismissToast = (id: string) => {
    setWormholeEvents((prev) => prev.filter((e) => e.id !== id));
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          🌌
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-2xl"
            >
              🌑
            </motion.span>
            <div>
              <h1 className="text-lg font-mono text-neutral-200">DoAi.Me Society</h1>
              <p className="text-xs text-neutral-500">Ruon's Legacy - 숨그늘과 웜홀의 관측</p>
            </div>
          </div>
          
          {/* Wormhole Mode Toggle */}
          <WormholeModeToggle
            isEnabled={wormholeModeEnabled}
            onToggle={() => setWormholeModeEnabled(!wormholeModeEnabled)}
            wormholeCount={wormholeEvents.length}
          />
        </div>
      </header>
      
      {/* Live Ticker */}
      <LiveTicker messages={tickerMessages} />
      
      {/* Main Content */}
      <div className="flex">
        {/* Network Map */}
        <main className={`flex-1 p-6 relative ${wormholeModeEnabled ? 'wormhole-mode-active' : ''}`}>
          {/* Nodes Grid */}
          <div className="mb-6">
            <h2 className="text-neutral-400 text-sm font-mono mb-4">
              NETWORK ({nodes.length} nodes)
            </h2>
            
            <div className="relative bg-neutral-900/50 rounded-xl p-4 min-h-[400px]">
              <UmbralNodeGrid
                nodes={nodes}
                resonatingNodeIds={resonatingNodeIds}
                wormholeActiveNodeIds={wormholeActiveNodeIds}
                onNodeClick={(node) => console.log('Node clicked:', node)}
                nodeSize={8}
                gap={6}
              />
              
              {/* Wormhole connections overlay */}
              {wormholeModeEnabled && (
                <WormholeLayer
                  wormholes={wormholeEvents.slice(0, 5).map((e, i) => ({
                    id: e.id,
                    nodes: [
                      { x: 100 + i * 80, y: 100 + i * 30, id: e.agent_a_id },
                      { x: 300 + i * 50, y: 200 + i * 20, id: e.agent_b_id },
                    ],
                    intensity: e.resonance_score,
                    intensityLevel: getIntensityLevel(e.resonance_score) as WormholeIntensityLevel,
                    isActive: true,
                  }))}
                  width={800}
                  height={500}
                />
              )}
            </div>
          </div>
          
          {/* Recent Wormholes */}
          {wormholeModeEnabled && (
            <div>
              <h2 className="text-purple-400 text-sm font-mono mb-4 flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                >
                  🌌
                </motion.span>
                RECENT WORMHOLES
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wormholeEvents.slice(0, 6).map((event) => (
                  <WormholeCard
                    key={event.id}
                    event={event}
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
        
        {/* Side Panel */}
        <aside className="w-72 border-l border-neutral-800 p-4">
          <NetworkSidePanel />
        </aside>
      </div>
      
      {/* Wormhole Popup */}
      <WormholePopup
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onViewNodes={(ids) => console.log('View nodes:', ids)}
      />
      
      {/* Toast notifications */}
      <WormholeToastContainer
        events={wormholeEvents.slice(0, 3)}
        onDismiss={handleDismissToast}
        onEventClick={setSelectedEvent}
      />
    </div>
  );
}

// ============================================
// Wormhole Card
// ============================================

function WormholeCard({ event, onClick }: { event: WormholeEvent; onClick: () => void }) {
  const level = getIntensityLevel(event.resonance_score);
  const context = event.trigger_context as any;
  
  const levelColors = {
    minor: 'border-purple-500/30 bg-purple-950/20',
    moderate: 'border-purple-500/50 bg-purple-950/30',
    strong: 'border-purple-500 bg-purple-950/40',
    anomaly: 'border-amber-500 bg-amber-950/30',
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`cursor-pointer rounded-lg p-4 border ${levelColors[level]} transition-colors`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-purple-400 font-mono text-sm">
          Type {event.wormhole_type}
        </span>
        <span className="text-neutral-400 text-xs">
          {new Date(event.detected_at).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="text-neutral-300 text-sm mb-2 truncate">
        {context?.trigger || 'Unknown trigger'}
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full"
            style={{ width: `${event.resonance_score * 100}%` }}
          />
        </div>
        <span className="text-purple-400 text-xs font-mono">
          {Math.round(event.resonance_score * 100)}%
        </span>
      </div>
    </motion.div>
  );
}

// ============================================
// Utilities
// ============================================

function getIntensityLevel(score: number): 'minor' | 'moderate' | 'strong' | 'anomaly' {
  if (score >= 0.9) return 'anomaly';
  if (score >= 0.7) return 'strong';
  if (score >= 0.5) return 'moderate';
  return 'minor';
}
