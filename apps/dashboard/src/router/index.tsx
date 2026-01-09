/**
 * DoAi.Me Control Room - Router Configuration
 * Aria의 사이트맵 명세서에 따른 라우터 설정
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from '@/layouts/PublicLayout';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

// Pages
import LandingPage from '@/pages/Landing';
import LoginPage from '@/pages/auth/Login';
import DashboardPage from '@/pages/Dashboard';
import DeviceCockpitPage from '@/pages/device/Cockpit';
import EconomyPage from '@/pages/Economy';
import SystemPage from '@/pages/System';
import NotFoundPage from '@/pages/NotFound';
import LSPPage from '@/pages/LSP';

// Guards
import { AuthGuard } from '@/guards/AuthGuard';

export const router = createBrowserRouter([
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC ROUTES (No Auth Required)
  // ═══════════════════════════════════════════════════════════════
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />,
      },
      {
        path: '/auth/login',
        element: <LoginPage />,
      },
      {
        path: '/lsp',
        element: <LSPPage />,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // PROTECTED ROUTES (Auth Required)
  // ═══════════════════════════════════════════════════════════════
  {
    element: (
      <AuthGuard>
        <AuthenticatedLayout />
      </AuthGuard>
    ),
    children: [
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/device/:deviceId',
        element: <DeviceCockpitPage />,
      },
      {
        path: '/economy',
        element: <EconomyPage />,
      },
      {
        path: '/system',
        element: <SystemPage />,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SPECIAL ROUTES
  // ═══════════════════════════════════════════════════════════════
  {
    path: '/404',
    element: <NotFoundPage />,
  },
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
]);

