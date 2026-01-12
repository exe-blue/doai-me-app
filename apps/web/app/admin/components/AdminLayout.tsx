'use client';

// ============================================
// AdminLayout - 21st.dev 스타일 리디자인
// shadcn/ui 기반 관리자 레이아웃
// 회원 등급별 메뉴 필터링 지원
// ============================================

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Activity,
  Terminal,
  FileText,
  Zap,
  Smartphone,
  Tv,
  LogOut,
  Menu,
  X,
  History,
  Users,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import type { UserPermissions, AdminRole, Resource } from '@/lib/auth/types';
import { ROLE_DISPLAY_NAMES, TIER_DISPLAY_NAMES } from '@/lib/auth/types';
import { checkPermission } from '@/lib/auth/permissions';

// ============================================
// Types
// ============================================

type TabId = 'dashboard' | 'wormholes' | 'nodes' | 'devices' | 'content' | 'monitoring' | 'command' | 'forms' | 'history' | 'members';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: TabId;
  permissions?: UserPermissions;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  resource: Resource;
}

// ============================================
// Navigation Items
// ============================================

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin', resource: 'dashboard' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, href: '/admin/monitoring', resource: 'monitoring' },
  { id: 'history', label: 'History', icon: History, href: '/admin/history', resource: 'history' },
  { id: 'command', label: 'Command', icon: Terminal, href: '/admin/command', resource: 'command' },
  { id: 'forms', label: 'Forms', icon: FileText, href: '/admin/forms', resource: 'forms' },
  { id: 'wormholes', label: 'Wormholes', icon: Zap, href: '/admin?tab=wormholes', badge: 'AI', resource: 'wormholes' },
  { id: 'devices', label: 'Devices', icon: Smartphone, href: '/admin/devices', resource: 'devices' },
  { id: 'content', label: 'Content', icon: Tv, href: '/admin/content', resource: 'content' },
  { id: 'members', label: 'Members', icon: Users, href: '/admin/members', resource: 'members' },
];

// ============================================
// Admin Layout Inner
// ============================================

function AdminLayoutInner({ children, activeTab, permissions }: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 권한에 따라 메뉴 필터링
  const filteredNavItems = useMemo(() => {
    if (!permissions) {
      // 권한 정보가 없으면 모든 메뉴 표시 (미들웨어에서 처리)
      return NAV_ITEMS;
    }
    
    return NAV_ITEMS.filter(item => 
      checkPermission(permissions.tier, permissions.adminRole, 'view', item.resource)
    );
  }, [permissions]);
  
  // Tab 결정
  const validTabs: TabId[] = ['dashboard', 'wormholes', 'nodes', 'devices', 'content', 'monitoring', 'command', 'forms', 'history', 'members'];
  
  const currentTab: TabId = activeTab || 
    (tabParam && validTabs.includes(tabParam as TabId) ? tabParam as TabId : 
    pathname === '/admin' ? 'dashboard' : 
    pathname?.includes('/monitoring') ? 'monitoring' :
    pathname?.includes('/history') ? 'history' :
    pathname?.includes('/command') ? 'command' :
    pathname?.includes('/forms') ? 'forms' :
    pathname?.includes('/devices') ? 'devices' :
    pathname?.includes('/content') ? 'content' :
    pathname?.includes('/members') ? 'members' : 'dashboard');

  // 역할 표시
  const roleDisplay = useMemo(() => {
    if (permissions?.adminRole) {
      return ROLE_DISPLAY_NAMES[permissions.adminRole];
    }
    if (permissions?.tier) {
      return TIER_DISPLAY_NAMES[permissions.tier];
    }
    return null;
  }, [permissions]);

  // 역할 색상
  const roleColor = useMemo(() => {
    if (permissions?.adminRole === 'owner') return 'text-amber-400 border-amber-500/50';
    if (permissions?.adminRole === 'admin') return 'text-purple-400 border-purple-500/50';
    if (permissions?.adminRole === 'viewer') return 'text-blue-400 border-blue-500/50';
    return 'text-muted-foreground border-border';
  }, [permissions]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-3 mr-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="text-2xl"
            >
              <Zap className="h-6 w-6 text-primary" />
            </motion.div>
            <span className="text-lg font-semibold">
              DoAi.Me <span className="text-muted-foreground font-normal">Admin</span>
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentTab === item.id}
              />
            ))}
          </nav>
          
          {/* Right Side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Live indicator */}
            <span className="hidden sm:flex gap-1.5 items-center px-2.5 py-0.5 border border-border rounded-full text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
            
            {/* Role Badge */}
            {roleDisplay && (
              <span className={cn(
                'hidden lg:flex gap-1.5 items-center px-2.5 py-0.5 border rounded-full text-xs font-medium',
                roleColor
              )}>
                <Shield className="h-3 w-3" />
                {roleDisplay}
              </span>
            )}
            
            {/* Logout Button */}
            <LogoutButton />
            
            {/* Mobile Menu Toggle */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border p-4 space-y-1 bg-background">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentTab === item.id}
                mobile
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
            
            {/* Mobile Role Badge */}
            {roleDisplay && (
              <div className={cn(
                'flex gap-1.5 items-center px-3 py-2 mt-2 border-t border-border pt-3',
                roleColor
              )}>
                <Shield className="h-4 w-4" />
                <span className="text-sm">{roleDisplay}</span>
              </div>
            )}
          </nav>
        )}
      </header>
      
      {/* Main Content */}
      <main className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================
// NavLink Component
// ============================================

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  mobile?: boolean;
  onClick?: () => void;
}

function NavLink({ item, active, mobile, onClick }: NavLinkProps) {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
        mobile ? 'w-full' : '',
        active 
          ? 'bg-primary/10 text-primary' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold rounded">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ============================================
// Logout Button
// ============================================

function LogoutButton() {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout failed:', error);
        return;
      }
      window.location.href = '/admin/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };
  
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-muted transition-colors"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="h-8 w-8 text-primary" />
        </motion.div>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

// ============================================
// Admin Layout (with Suspense)
// ============================================

export function AdminLayout({ children, activeTab, permissions }: AdminLayoutProps) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AdminLayoutInner activeTab={activeTab} permissions={permissions}>{children}</AdminLayoutInner>
    </Suspense>
  );
}
