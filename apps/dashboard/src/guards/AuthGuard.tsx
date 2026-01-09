/**
 * AuthGuard - 인증된 사용자만 접근 가능하도록 보호
 * 미인증 시 /auth/login으로 리다이렉트
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // 현재 위치를 state로 저장하여 로그인 후 돌아올 수 있도록
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

