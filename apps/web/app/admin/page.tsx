// app/admin/page.tsx
// Admin Dashboard - Wormhole + Umbra MVP

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase/client';

// Widgets
import { 
  WormholeVolumeWidget,
  WormholeTopContextWidget,
  WormholeTypeDistributionWidget,
  WormholeScoreHistogramWidget,
} from './components/WormholeWidgets';
import { NodesStatusSummaryWidget, NodesList } from './components/NodesStatusPanel';
import { WormholeEventsList } from './components/WormholeEventsList';

// ============================================
// Admin Dashboard
// ============================================

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'wormholes' | 'nodes'>('wormholes');
  const [timeFilter, setTimeFilter] = useState<'1h' | '24h' | '7d' | 'all'>('24h');
  const [contextFilter, setContextFilter] = useState<string | undefined>();
  
  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthorized(false);
        return;
      }
      
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAuthorized(
        adminUser?.role === 'admin' || 
        adminUser?.role === 'super_admin' || 
        adminUser?.role === 'viewer'
      );
    };
    
    checkAuth();
  }, []);
  
  // Loading
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin text-purple-500 text-4xl">🕳️</div>
      </div>
    );
  }
  
  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl text-neutral-200 mb-2">Access Denied</h1>
          <p className="text-neutral-500 mb-6">
            관리자 승인이 필요합니다. <br />
            승인 후 다시 시도해주세요.
          </p>
          <a
            href="/auth/login"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            로그인
          </a>
        </div>
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
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              🕳️
            </motion.span>
            <h1 className="text-lg font-mono text-neutral-200">DoAi.Me Admin</h1>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <TabButton 
              active={activeTab === 'wormholes'} 
              onClick={() => setActiveTab('wormholes')}
            >
              🕳️ Wormholes
            </TabButton>
            <TabButton 
              active={activeTab === 'nodes'} 
              onClick={() => setActiveTab('nodes')}
            >
              🖥️ Nodes
            </TabButton>
          </div>
          
          {/* User Menu */}
          <div className="text-neutral-500 text-sm">
            <LogoutButton />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'wormholes' ? (
          <WormholesTab 
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            contextFilter={contextFilter}
            setContextFilter={setContextFilter}
          />
        ) : (
          <NodesTab />
        )}
      </main>
    </div>
  );
}

// ============================================
// Wormholes Tab
// ============================================

interface WormholesTabProps {
  timeFilter: '1h' | '24h' | '7d' | 'all';
  setTimeFilter: (f: '1h' | '24h' | '7d' | 'all') => void;
  contextFilter?: string;
  setContextFilter: (c: string | undefined) => void;
}

function WormholesTab({ timeFilter, setTimeFilter, contextFilter, setContextFilter }: WormholesTabProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WormholeVolumeWidget />
        <WormholeTypeDistributionWidget />
        <WormholeScoreHistogramWidget />
      </div>
      
      {/* Row 2: Context + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Top Contexts */}
        <div>
          <WormholeTopContextWidget 
            onContextClick={(ctx) => setContextFilter(ctx === contextFilter ? undefined : ctx)}
          />
        </div>
        
        {/* Right: Events List */}
        <div className="lg:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg">
            {/* Filter Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-neutral-300 text-sm font-mono">WORMHOLE EVENTS</span>
                {contextFilter && (
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 text-xs rounded">
                    {contextFilter}
                    <button 
                      onClick={() => setContextFilter(undefined)}
                      className="ml-1 hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              
              {/* Time Filter */}
              <div className="flex gap-1">
                {(['1h', '24h', '7d', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeFilter(t)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      timeFilter === t 
                        ? 'bg-neutral-700 text-neutral-200' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Events List */}
            <div className="p-4 max-h-[500px] overflow-y-auto">
              <WormholeEventsList 
                timeFilter={timeFilter}
                contextFilter={contextFilter}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Nodes Tab
// ============================================

function NodesTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  
  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <NodesStatusSummaryWidget />
      
      {/* Nodes List */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <span className="text-neutral-300 text-sm font-mono">NODE LIST</span>
          
          {/* Status Filter */}
          <div className="flex gap-1">
            {[undefined, 'active', 'in_umbra', 'offline', 'error'].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  statusFilter === s 
                    ? 'bg-neutral-700 text-neutral-200' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {s === undefined ? 'All' : s === 'in_umbra' ? '숨그늘' : s}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 max-h-[600px] overflow-y-auto">
          <NodesList statusFilter={statusFilter} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// UI Components
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
        active 
          ? 'bg-neutral-800 text-neutral-100' 
          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
      }`}
    >
      {children}
    </button>
  );
}

function LogoutButton() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };
  
  return (
    <button
      onClick={handleLogout}
      className="hover:text-neutral-300 transition-colors"
    >
      Logout
    </button>
  );
}
