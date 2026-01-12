/**
 * Auth Types for Dashboard App
 * 
 * 회원 등급 체계:
 * - 일반 회원: associate(준회원), regular(정회원), special(특별회원)
 * - 관리자: admin(관리자), owner(소유자)
 */

/**
 * 일반 사용자 회원 등급
 */
export type MembershipTier = 'associate' | 'regular' | 'special';

/**
 * 관리자 역할
 */
export type AdminRole = 'pending' | 'viewer' | 'admin' | 'owner';

/**
 * 통합 역할 타입
 */
export type UserRole = MembershipTier | AdminRole;

/**
 * 사용자 정보
 */
export interface User {
  id: string;
  email: string;
  name: string;
  tier: MembershipTier | null;
  adminRole: AdminRole | null;
  isAdmin: boolean;
  isOwner: boolean;
}

/**
 * 등급 표시 이름 (한글)
 */
export const TIER_DISPLAY_NAMES: Record<MembershipTier, string> = {
  associate: '준회원',
  regular: '정회원',
  special: '특별회원',
};

export const ROLE_DISPLAY_NAMES: Record<AdminRole, string> = {
  pending: '승인 대기',
  viewer: '뷰어',
  admin: '관리자',
  owner: '소유자',
};

/**
 * 사용자의 표시 등급 반환
 */
export function getDisplayRole(user: User | null): string {
  if (!user) return '비회원';
  
  if (user.adminRole) {
    return ROLE_DISPLAY_NAMES[user.adminRole];
  }
  if (user.tier) {
    return TIER_DISPLAY_NAMES[user.tier];
  }
  return '비회원';
}
