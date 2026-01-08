'use client';

// ============================================
// AdminLayout - 21st.dev 스타일 리디자인
// shadcn/ui 기반 관리자 레이아웃
// ============================================

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
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
} from 'lucide-react';
import { useState } from 'react';

// ============================================
// Types
// ============================================

type TabId = 'dashboard' | 'wormholes' | 'nodes' | 'devices' | 'content' | 'monitoring' | 'command' | 'forms' | 'history';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: TabId;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

// ============================================
// Navigation Items
// ============================================

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, href: '/admin/monitoring' },
  { id: 'history', label: 'History', icon: History, href: '/admin/history' },
  { id: 'command', label: 'Command', icon: Terminal, href: '/admin/command' },
  { id: 'forms', label: 'Forms', icon: FileText, href: '/admin/forms' },
  { id: 'wormholes', label: 'Wormholes', icon: Zap, href: '/admin?tab=wormholes', badge: 'AI' },
  { id: 'devices', label: 'Devices', icon: Smartphone, href: '/admin/devices' },
  { id: 'content', label: 'Content', icon: Tv, href: '/admin/content' },
];

// ============================================
// Admin Layout Inner
// ============================================

function AdminLayoutInner({ children, activeTab }: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Tab 결정
  const validTabs: TabId[] = ['dashboard', 'wormholes', 'nodes', 'devices', 'content', 'monitoring', 'command', 'forms', 'history'];
  
  const currentTab: TabId = activeTab || 
    (tabParam && validTabs.includes(tabParam as TabId) ? tabParam as TabId : 
    pathname === '/admin' ? 'dashboard' : 
    pathname?.includes('/monitoring') ? 'monitoring' :
    pathname?.includes('/history') ? 'history' :
    pathname?.includes('/command') ? 'command' :
    pathname?.includes('/forms') ? 'forms' :
    pathname?.includes('/devices') ? 'devices' :
    pathname?.includes('/content') ? 'content' : 'dashboard');

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
            {NAV_ITEMS.map((item) => (
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
            <Badge variant="outline" className="hidden sm:flex gap-1.5 items-center">
              <span className="h-2 w-2 rounded-full bg-signal-green animate-pulse" />
              Live
            </Badge>
            
            {/* Logout Button */}
            <LogoutButton />
            
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border p-4 space-y-1 bg-background">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={currentTab === item.id}
                mobile
                onClick={() => setMobileMenuOpen(false)}
              />
            ))}
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
        <Badge variant="secondary" className="ml-auto text-[10px] h-5">
          {item.badge}
        </Badge>
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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Logout</span>
    </Button>
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

export function AdminLayout({ children, activeTab }: AdminLayoutProps) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AdminLayoutInner activeTab={activeTab}>{children}</AdminLayoutInner>
    </Suspense>
  );
}
