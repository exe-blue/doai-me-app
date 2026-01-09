/**
 * GlobalNavBar - 전역 네비게이션 바
 * Aria 명세서: Position STICKY_TOP, Height 56px, zIndex 1000
 */
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocketStore } from '@/stores/websocketStore';

// Navigation Items
const NAV_ITEMS = [
  { label: 'HIVE', route: '/dashboard', icon: '⊞' },
  { label: 'Economy', route: '/economy', icon: '💰' },
  { label: 'System', route: '/system', icon: '⚙️' },
] as const;

export function GlobalNavBar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { connectionStatus } = useWebSocketStore();

  const isActive = (route: string) => {
    if (route === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/device/');
    }
    return location.pathname === route;
  };

  return (
    <header className="sticky top-0 z-[1000] h-14 bg-doai-black-900 border-b border-doai-black-700">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left Section: Logo + Brand */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link 
            to="/dashboard" 
            className="flex items-center gap-2 text-doai-yellow-500 hover:text-doai-yellow-400 transition-colors"
          >
            <span className="text-2xl">🐝</span>
            <span className="font-display font-bold text-lg">DoAi.Me</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.route}
                to={item.route}
                className={isActive(item.route) ? 'nav-link-active' : 'nav-link'}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section: Status Indicators + Actions */}
        <div className="flex items-center gap-4">
          {/* Accident Button */}
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-error/20 text-error 
                       rounded-lg font-medium text-sm border border-error/30
                       hover:bg-error/30 transition-colors"
            onClick={() => {
              // TODO: Open accident trigger modal
              console.log('Accident trigger clicked');
            }}
          >
            <span className="animate-pulse">🔴</span>
            <span className="hidden sm:inline">ACCIDENT</span>
          </button>

          {/* WebSocket Status */}
          <div className="flex items-center gap-1.5" title={`WebSocket: ${connectionStatus}`}>
            <span 
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' 
                  ? 'bg-status-online' 
                  : connectionStatus === 'connecting'
                    ? 'bg-status-busy animate-pulse'
                    : 'bg-status-offline'
              }`}
            />
            <span className="text-xs text-gray-500 hidden sm:inline">WS</span>
          </div>

          {/* User Menu */}
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 hidden md:inline">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="btn-ghost text-sm py-1.5"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

