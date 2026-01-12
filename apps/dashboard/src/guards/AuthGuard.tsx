/**
 * AuthGuard - 인증 및 권한 기반 접근 제어
 * 
 * 기능:
 * - 미인증 사용자: /auth/login으로 리다이렉트
 * - 권한 부족: /unauthorized로 리다이렉트 (또는 커스텀 경로)
 * - 최소 등급/역할 요구사항 설정 가능
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { ReactNode } from 'react';
import type { MembershipTier, AdminRole } from '@/lib/auth/types';

// ============================================
// Types
// ============================================

interface AuthGuardProps {
  children: ReactNode;
  /** 최소 회원 등급 요구 (일반 사용자용) */
  requiredTier?: MembershipTier;
  /** 최소 관리자 역할 요구 */
  requiredRole?: AdminRole;
  /** 관리자만 허용 */
  adminOnly?: boolean;
  /** 권한 부족 시 리다이렉트 경로 */
  fallbackPath?: string;
}

// ============================================
// 등급/역할 순서 정의
// ============================================

const TIER_ORDER: Record<MembershipTier, number> = {
  associate: 1,
  regular: 2,
  special: 3,
};

const ROLE_ORDER: Record<AdminRole, number> = {
  pending: 0,
  viewer: 1,
  admin: 2,
  owner: 3,
};

// ============================================
// AuthGuard Component
// ============================================

export function AuthGuard({ 
  children,
  requiredTier,
  requiredRole,
  adminOnly = false,
  fallbackPath = '/unauthorized',
}: AuthGuardProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // 미인증 사용자
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 관리자 전용 체크
  if (adminOnly && !user.isAdmin) {
    return <Navigate to={fallbackPath} replace />;
  }

  // 최소 관리자 역할 체크
  if (requiredRole && user.adminRole) {
    const currentRoleLevel = ROLE_ORDER[user.adminRole];
    const requiredRoleLevel = ROLE_ORDER[requiredRole];
    
    if (currentRoleLevel < requiredRoleLevel) {
      return <Navigate to={fallbackPath} replace />;
    }
  } else if (requiredRole && !user.adminRole) {
    // 관리자 역할 요구하는데 관리자가 아닌 경우
    return <Navigate to={fallbackPath} replace />;
  }

  // 최소 회원 등급 체크 (관리자는 무조건 통과)
  if (requiredTier && !user.adminRole) {
    if (!user.tier) {
      return <Navigate to={fallbackPath} replace />;
    }
    
    const currentTierLevel = TIER_ORDER[user.tier];
    const requiredTierLevel = TIER_ORDER[requiredTier];
    
    if (currentTierLevel < requiredTierLevel) {
      // 준회원은 철학 라이브러리로 리다이렉트
      if (user.tier === 'associate') {
        return <Navigate to="/philosophy" replace />;
      }
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}

// ============================================
// 편의 컴포넌트
// ============================================

/**
 * 관리자 전용 가드
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard adminOnly>
      {children}
    </AuthGuard>
  );
}

/**
 * 소유자 전용 가드
 */
export function OwnerGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRole="owner">
      {children}
    </AuthGuard>
  );
}

/**
 * 정회원 이상 가드
 */
export function RegularMemberGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredTier="regular">
      {children}
    </AuthGuard>
  );
}

/**
 * 특별회원 이상 가드
 */
export function SpecialMemberGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredTier="special">
      {children}
    </AuthGuard>
  );
}
