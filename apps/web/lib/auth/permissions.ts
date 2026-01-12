// lib/auth/permissions.ts
// 권한 체크 로직

import type { 
  MembershipTier, 
  AdminRole, 
  Action, 
  Resource,
  UserPermissions,
  PermissionMatrix 
} from './types';

// ============================================
// 권한 매트릭스 정의
// ============================================

/**
 * 리소스별 권한 매트릭스
 * 
 * 권한 규칙:
 * - 준회원(associate): 철학 라이브러리만 조회
 * - 정회원(regular): 전체 메뉴 조회
 * - 특별회원(special): 조회 + 등록
 * - 관리자(admin): 조회 + 등록 + 수정
 * - 소유자(owner): 모든 권한 (삭제, 회원등급변경 포함)
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
  // 철학 라이브러리 - 모든 회원 조회 가능
  philosophy: {
    view: 'all',
    create: ['admin', 'owner'],
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 대시보드 - 정회원 이상 조회
  dashboard: {
    view: ['regular', 'special'],
    create: 'none',
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 모니터링 - 정회원 이상 조회
  monitoring: {
    view: ['regular', 'special'],
    create: 'none',
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 히스토리 - 정회원 이상 조회
  history: {
    view: ['regular', 'special'],
    create: 'none',
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 커맨드 - 특별회원 이상
  command: {
    view: ['special'],
    create: ['special'],
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 폼 - 정회원 이상 조회, 특별회원 이상 등록
  forms: {
    view: ['regular', 'special'],
    create: ['special'],
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 웜홀 - 정회원 이상 조회
  wormholes: {
    view: ['regular', 'special'],
    create: 'none',
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 디바이스 - 정회원 이상 조회
  devices: {
    view: ['regular', 'special'],
    create: ['special'],
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 콘텐츠 - 정회원 이상 조회, 특별회원 등록
  content: {
    view: ['regular', 'special'],
    create: ['special'],
    edit: ['admin', 'owner'],
    delete: ['owner'],
  },
  
  // 회원 관리 - 관리자 조회, 소유자만 수정
  members: {
    view: ['admin', 'owner'],
    create: ['owner'],
    edit: ['owner'],
    delete: ['owner'],
  },
  
  // 시스템 설정 - 소유자만
  system: {
    view: ['admin', 'owner'],
    create: ['owner'],
    edit: ['owner'],
    delete: ['owner'],
  },
};

// ============================================
// 권한 체크 함수
// ============================================

/**
 * 권한 체크 메인 함수
 * 
 * @param tier - 사용자 회원 등급 (일반 사용자)
 * @param adminRole - 관리자 역할
 * @param action - 수행하려는 액션 (view, create, edit, delete)
 * @param resource - 접근하려는 리소스
 * @returns 권한 유무
 */
export function checkPermission(
  tier: MembershipTier | null,
  adminRole: AdminRole | null,
  action: Action,
  resource: Resource
): boolean {
  // 소유자: 모든 권한
  if (adminRole === 'owner') {
    return true;
  }
  
  // 관리자: 삭제와 회원관리 제외 모든 권한
  if (adminRole === 'admin') {
    if (action === 'delete') {
      return false;
    }
    if (resource === 'members' && action !== 'view') {
      return false;
    }
    return true;
  }
  
  // viewer (기존 호환): 정회원과 동일하게 처리
  if (adminRole === 'viewer') {
    return action === 'view' && resource !== 'members';
  }
  
  // pending: 권한 없음
  if (adminRole === 'pending') {
    return false;
  }
  
  // 일반 사용자 권한 체크
  const resourcePermission = PERMISSION_MATRIX[resource];
  if (!resourcePermission) {
    return false;
  }
  
  const allowedRoles = resourcePermission[action];
  
  // 'none'인 경우 일반 사용자 불가
  if (allowedRoles === 'none') {
    return false;
  }
  
  // 'all'인 경우 모든 인증된 사용자 허용
  if (allowedRoles === 'all') {
    return tier !== null || adminRole !== null;
  }
  
  // 배열인 경우 tier 또는 adminRole이 포함되어 있는지 확인
  if (tier && (allowedRoles as string[]).includes(tier)) {
    return true;
  }
  
  if (adminRole && (allowedRoles as string[]).includes(adminRole)) {
    return true;
  }
  
  return false;
}

/**
 * UserPermissions 객체로 권한 체크
 */
export function hasPermission(
  permissions: UserPermissions,
  action: Action,
  resource: Resource
): boolean {
  return checkPermission(
    permissions.tier,
    permissions.adminRole,
    action,
    resource
  );
}

/**
 * 여러 리소스에 대한 권한을 한 번에 체크
 */
export function checkMultiplePermissions(
  permissions: UserPermissions,
  checks: Array<{ action: Action; resource: Resource }>
): boolean[] {
  return checks.map(({ action, resource }) => 
    hasPermission(permissions, action, resource)
  );
}

/**
 * 특정 리소스에 대한 모든 권한 반환
 */
export function getResourcePermissions(
  permissions: UserPermissions,
  resource: Resource
): Record<Action, boolean> {
  return {
    view: hasPermission(permissions, 'view', resource),
    create: hasPermission(permissions, 'create', resource),
    edit: hasPermission(permissions, 'edit', resource),
    delete: hasPermission(permissions, 'delete', resource),
  };
}

// ============================================
// 메뉴 접근 권한 체크
// ============================================

/**
 * 어드민 메뉴 아이템 타입
 */
export interface AdminMenuItem {
  id: string;
  label: string;
  href: string;
  resource: Resource;
}

/**
 * 권한에 따라 접근 가능한 메뉴 필터링
 */
export function filterMenuByPermissions(
  menuItems: AdminMenuItem[],
  permissions: UserPermissions
): AdminMenuItem[] {
  return menuItems.filter(item => 
    hasPermission(permissions, 'view', item.resource)
  );
}

// ============================================
// 권한 등급 비교 유틸리티
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

/**
 * 회원 등급 비교 (높은 등급이 큰 값)
 */
export function compareTiers(a: MembershipTier, b: MembershipTier): number {
  return TIER_ORDER[a] - TIER_ORDER[b];
}

/**
 * 관리자 역할 비교 (높은 역할이 큰 값)
 */
export function compareRoles(a: AdminRole, b: AdminRole): number {
  return ROLE_ORDER[a] - ROLE_ORDER[b];
}

/**
 * 최소 등급 이상인지 확인
 */
export function isAtLeastTier(
  currentTier: MembershipTier | null,
  requiredTier: MembershipTier
): boolean {
  if (!currentTier) return false;
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
}

/**
 * 최소 역할 이상인지 확인
 */
export function isAtLeastRole(
  currentRole: AdminRole | null,
  requiredRole: AdminRole
): boolean {
  if (!currentRole) return false;
  return ROLE_ORDER[currentRole] >= ROLE_ORDER[requiredRole];
}
