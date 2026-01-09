/**
 * Header Component - Navigation header
 * Ported from apps/web for dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

interface MenuItem {
  id: string;
  label: string;
  href?: string;
  available: boolean;
  description?: string;
}

interface HeaderProps {
  isDark?: boolean;
  onToggleTheme?: () => void;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'home', label: 'HOME', href: '/', available: true },
  { id: 'market', label: 'MARKET', href: '/dashboard', available: true, description: 'AI Control Room' },
  { id: 'infra', label: 'INFRA', available: false, description: '채널 편성표' },
  { id: 'poc', label: 'POC', available: false, description: 'Kernel Test' },
  { id: 'philosophy', label: 'PHILOSOPHY', available: false, description: '철학, 비전' },
  { id: 'knowledge', label: 'KNOWLEDGE', available: false, description: '아카이브' },
  { id: 'about', label: 'ABOUT', available: false, description: "Founder's Story" },
];

export function Header({ isDark = true }: HeaderProps) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleMenuClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const isActive = (item: MenuItem) => {
    if (item.href === location.pathname) return true;
    if (item.href === '/dashboard' && location.pathname.startsWith('/dashboard')) return true;
    return false;
  };

  return (
    <>
      <nav className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0A0A0A]/95 border-b border-white/10 backdrop-blur-xl py-2'
          : 'py-4'
      )}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-1 group"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img src="/logo-dark.svg" alt="DoAi.Me" className="h-8 w-auto" />
          </Link>

          {/* Desktop Menu */}
          <div className={clsx(
            'hidden md:flex items-center gap-1',
            !scrolled && 'px-2 py-1 rounded-full bg-white/5'
          )}>
            {MENU_ITEMS.map(item => (
              <MenuButton
                key={item.id}
                item={item}
                isActive={isActive(item)}
                isDark={isDark}
                onClick={handleMenuClick}
              />
            ))}
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-400 hover:bg-white/10"
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-16 left-0 right-0 bottom-0 z-40 md:hidden overflow-y-auto bg-[#0A0A0A]">
            <div className="p-4 space-y-2">
              {MENU_ITEMS.map(item => (
                <MobileMenuItem
                  key={item.id}
                  item={item}
                  isActive={isActive(item)}
                  onClick={handleMenuClick}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

interface MenuButtonProps {
  item: MenuItem;
  isActive: boolean;
  isDark: boolean;
  onClick: () => void;
}

function MenuButton({ item, isActive, isDark, onClick }: MenuButtonProps) {
  if (item.href && item.available) {
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={clsx(
          'relative px-3 lg:px-4 py-2 text-xs font-medium tracking-wider rounded-full transition-all',
          isActive
            ? 'text-[#FFCC00] bg-[#FFCC00]/10 font-bold'
            : isDark
              ? 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <button
      disabled={!item.available}
      className={clsx(
        'relative px-3 lg:px-4 py-2 text-xs font-medium tracking-wider rounded-full',
        'text-neutral-600 opacity-40 cursor-not-allowed'
      )}
    >
      {item.label}
    </button>
  );
}

interface MobileMenuItemProps {
  item: MenuItem;
  isActive: boolean;
  onClick: () => void;
}

function MobileMenuItem({ item, isActive, onClick }: MobileMenuItemProps) {
  if (item.href && item.available) {
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={clsx(
          'flex items-center justify-between p-4 rounded-xl transition-all',
          isActive
            ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30'
            : 'bg-white/5 hover:bg-white/10'
        )}
      >
        <div>
          <div className={clsx('font-medium text-sm', isActive && 'text-[#FFCC00]')}>
            {item.label}
          </div>
          {item.description && (
            <div className="text-xs text-neutral-500">{item.description}</div>
          )}
        </div>
        <span className="text-neutral-600">→</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-xl opacity-40 bg-white/5">
      <div>
        <div className="font-medium text-sm">
          {item.label}
          <span className="ml-2 text-xs text-purple-400 font-normal">준비중</span>
        </div>
        {item.description && (
          <div className="text-xs text-neutral-500">{item.description}</div>
        )}
      </div>
    </div>
  );
}
