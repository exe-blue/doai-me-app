'use client';

// ============================================
// Header - 공통 헤더 컴포넌트
// 반응형 네비게이션 + 햄버거 메뉴 지원
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home as HomeIcon, TrendingUp, Tv, Newspaper, Users, Coins, Building,
  Moon, Sun, Menu, X, ChevronRight
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  available: boolean;
  description?: string;
}

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  isSimulationMode?: boolean;
  /** 현재 활성 뷰 (내부 네비게이션용) */
  currentView?: string;
  /** 뷰 변경 핸들러 (내부 네비게이션용) */
  onViewChange?: (view: string) => void;
}

// ============================================
// Menu Items
// ============================================

const MENU_ITEMS: MenuItem[] = [
  { id: 'home', label: 'HOME', icon: HomeIcon, href: '/', available: true },
  { id: 'consume', label: 'CONSUME', icon: TrendingUp, href: '/consume', available: true, description: 'AI 노드 관제' },
  { id: 'channel', label: 'CHANNEL', icon: Tv, href: '/channel', available: true, description: '채널 편성표' },
  { id: 'news', label: 'NEWS', icon: Newspaper, href: '/news', available: true, description: 'AI 뉴스 피드' },
  { id: 'society', label: 'SOCIETY', icon: Users, href: '/society', available: true, description: '존재 증명' },
  { id: 'economy', label: 'ECONOMY', icon: Coins, href: '/economy', available: true, description: '보상 구조' },
  { id: 'apartment', label: 'APARTMENT', icon: Building, href: '/apartment', available: true, description: '디바이스 관리' },
];

// ============================================
// Header Component
// ============================================

export function Header({ 
  isDark, 
  onToggleTheme, 
  isSimulationMode,
  currentView,
  onViewChange,
}: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 모바일 메뉴 열림 시 스크롤 방지
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // 메뉴 아이템 클릭 핸들러
  const handleMenuClick = useCallback((item: MenuItem) => {
    setMobileMenuOpen(false);
    
    // 내부 뷰 변경
    if (onViewChange && !item.href) {
      onViewChange(item.id);
    }
  }, [onViewChange]);

  // 현재 활성 메뉴 확인
  const isActive = (item: MenuItem) => {
    if (item.href === pathname) return true;
    if (currentView && item.id === currentView) return true;
    return false;
  };

  return (
    <>
      <nav className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled 
          ? `${isDark 
              ? 'bg-[#0A0A0A]/95 border-b border-white/10' 
              : 'bg-white/95 border-b border-neutral-200 shadow-sm'
            } backdrop-blur-xl py-2` 
          : 'py-4'
        }
      `}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/"
            className="flex items-center gap-2 group"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="text-2xl font-bold text-[#FFCC00]">DoAi</span>
            <span className={`text-2xl font-light ${isDark ? 'text-white' : 'text-black'}`}>.Me</span>
          </Link>

          {/* Desktop Menu */}
          <div className={`hidden md:flex items-center gap-1 ${
            scrolled 
              ? '' 
              : `px-2 py-1 rounded-full ${isDark ? 'bg-white/5' : 'bg-black/5'}`
          }`}>
            {MENU_ITEMS.map(item => (
              <MenuButton
                key={item.id}
                item={item}
                isActive={isActive(item)}
                isDark={isDark}
                onClick={() => handleMenuClick(item)}
              />
            ))}

            {/* Theme Toggle */}
            <button 
              onClick={onToggleTheme}
              className={`
                ml-2 p-2.5 rounded-full transition-all
                ${isDark 
                  ? 'text-neutral-400 hover:text-yellow-400 hover:bg-yellow-400/10' 
                  : 'text-neutral-500 hover:text-yellow-600 hover:bg-yellow-400/20'
                }
              `}
              aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Simulation Mode Badge */}
            {isSimulationMode && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                SIM
              </span>
            )}

            {/* Theme Toggle (Mobile) */}
            <button 
              onClick={onToggleTheme}
              className={`p-2 rounded-lg ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
              aria-label={isDark ? '라이트 모드' : '다크 모드'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg ${isDark ? 'text-neutral-400 hover:bg-white/10' : 'text-neutral-600 hover:bg-black/10'}`}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        isDark={isDark}
        menuItems={MENU_ITEMS}
        isActive={isActive}
        onItemClick={handleMenuClick}
        onClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
}

// ============================================
// Menu Button (Desktop)
// ============================================

interface MenuButtonProps {
  item: MenuItem;
  isActive: boolean;
  isDark: boolean;
  onClick: () => void;
}

function MenuButton({ item, isActive, isDark, onClick }: MenuButtonProps) {
  const Icon = item.icon;
  
  // 외부 링크 (href가 있고 available인 경우)
  if (item.href && item.available) {
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={`
          relative px-3 lg:px-4 py-2 text-xs font-medium tracking-wider rounded-full transition-all
          flex items-center gap-1.5
          ${isActive 
            ? `${isDark 
                ? 'text-[#FFCC00] bg-[#FFCC00]/10' 
                : 'text-yellow-600 bg-yellow-400/20'
              } font-bold` 
            : `${isDark 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5' 
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
              }`
          }
        `}
      >
        <Icon className="w-3.5 h-3.5" />
        {item.label}
      </Link>
    );
  }

  // 비활성화된 메뉴
  if (!item.available) {
    return (
      <button
        disabled
        className={`
          relative px-3 lg:px-4 py-2 text-xs font-medium tracking-wider rounded-full
          ${isDark ? 'text-neutral-600' : 'text-neutral-400'}
          opacity-40 cursor-not-allowed
        `}
      >
        {item.label}
      </button>
    );
  }

  // 내부 뷰 전환 버튼
  return (
    <button
      onClick={onClick}
      className={`
        relative px-3 lg:px-4 py-2 text-xs font-medium tracking-wider rounded-full transition-all
        ${isActive 
          ? `${isDark 
              ? 'text-[#FFCC00] bg-[#FFCC00]/10' 
              : 'text-yellow-600 bg-yellow-400/20'
            } font-bold` 
          : `${isDark 
              ? 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
            }`
        }
      `}
    >
      {item.label}
    </button>
  );
}

// ============================================
// Mobile Menu
// ============================================

interface MobileMenuProps {
  isOpen: boolean;
  isDark: boolean;
  menuItems: MenuItem[];
  isActive: (item: MenuItem) => boolean;
  onItemClick: (item: MenuItem) => void;
  onClose: () => void;
}

function MobileMenu({ isOpen, isDark, menuItems, isActive, onItemClick, onClose }: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className={`
        fixed top-16 left-0 right-0 bottom-0 z-40 md:hidden overflow-y-auto
        ${isDark ? 'bg-[#0A0A0A]' : 'bg-white'}
      `}>
        <div className="p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item);

            if (item.href && item.available) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => onItemClick(item)}
                  className={`
                    flex items-center justify-between p-4 rounded-xl transition-all
                    ${active
                      ? isDark ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30' : 'bg-yellow-50 border border-yellow-200'
                      : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${active ? 'text-[#FFCC00]' : isDark ? 'text-neutral-500' : 'text-neutral-600'}`} />
                    <div>
                      <div className={`font-medium text-sm ${active ? 'text-[#FFCC00]' : ''}`}>
                        {item.label}
                      </div>
                      {item.description && (
                        <div className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                disabled={!item.available}
                onClick={() => item.available && onItemClick(item)}
                className={`
                  w-full flex items-center justify-between p-4 rounded-xl transition-all
                  ${!item.available 
                    ? 'opacity-40 cursor-not-allowed'
                    : active
                      ? isDark ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30' : 'bg-yellow-50 border border-yellow-200'
                      : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-[#FFCC00]' : isDark ? 'text-neutral-500' : 'text-neutral-600'}`} />
                  <div className="text-left">
                    <div className={`font-medium text-sm ${active ? 'text-[#FFCC00]' : ''}`}>
                      {item.label}
                      {!item.available && (
                        <span className="ml-2 text-xs text-purple-400 font-normal">준비중</span>
                      )}
                    </div>
                    {item.description && (
                      <div className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                {item.available && (
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
