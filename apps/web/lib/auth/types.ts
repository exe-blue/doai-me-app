// lib/auth/types.ts
// 회원 등급 및 권한 타입 정의

import { z } from 'zod';

// ============================================
// 회원 등급 타입
// ============================================

/**
 * 일반 사용자 회원 등급
 * - associate: 준회원 (철학 라이브러리만 조회 가능)
 * - regular: 정회원 (전체 메뉴 조회 가능)
 * - special: 특별회원 (등록 가능)
 */
export const MembershipTierSchema = z.enum(['associate', 'regular', 'special']);
export type MembershipTier = z.infer<typeof MembershipTierSchema>;

/**
 * 관리자 역할
 * - pending: 승인 대기
 * - viewer: 읽기 전용 (기존 호환)
 * - admin: 관리자 (입력/수정 가능)
 * - owner: 소유자 (삭제/회원등급변경 가능)
 */
export const AdminRoleSchema = z.enum(['pending', 'viewer', 'admin', 'owner']);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

/**
 * 통합 사용자 권한 타입
 */
export interface UserPermissions {
  userId: string | null;
  email: string | null;
  tier: MembershipTier | null;
  adminRole: AdminRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  displayName: string | null;
}

/**
 * 인증 결과 타입
 */
export interface AuthResult {
  authorized: boolean;
  permissions: UserPermissions;
  error?: string;
}

// ============================================
// 리소스 및 액션 타입
// ============================================

/**
 * 보호되는 리소스 목록
 */
export const ResourceSchema = z.enum([
  'philosophy',    // 철학 라이브러리
  'dashboard',     // 대시보드
  'monitoring',    // 모니터링
  'history',       // 히스토리
  'command',       // 커맨드
  'forms',         // 폼
  'wormholes',     // 웜홀
  'devices',       // 디바이스
  'content',       // 콘텐츠 (채널, 위협, 경제)
  'members',       // 회원 관리
  'system',        // 시스템 설정
]);
export type Resource = z.infer<typeof ResourceSchema>;

/**
 * 가능한 액션 목록
 */
export const ActionSchema = z.enum(['view', 'create', 'edit', 'delete']);
export type Action = z.infer<typeof ActionSchema>;

// ============================================
// 권한 매트릭스 타입
// ============================================

/**
 * 리소스별 허용 등급 설정
 */
export interface ResourcePermission {
  view: MembershipTier[] | AdminRole[] | 'all';
  create: MembershipTier[] | AdminRole[] | 'none';
  edit: AdminRole[] | 'none';
  delete: AdminRole[] | 'none';
}

export type PermissionMatrix = Record<Resource, ResourcePermission>;

// ============================================
// Zod 스키마 기반 검증
// ============================================

export const UserMembershipSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tier: MembershipTierSchema,
  display_name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UserMembership = z.infer<typeof UserMembershipSchema>;

export const AdminUserSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  role: AdminRoleSchema,
  email: z.string().email().optional(),
  created_at: z.string().datetime().optional(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

// ============================================
// 기본 권한 객체 (비인증 사용자)
// ============================================

export const DEFAULT_PERMISSIONS: UserPermissions = {
  userId: null,
  email: null,
  tier: null,
  adminRole: null,
  isAdmin: false,
  isOwner: false,
  displayName: null,
};

// ============================================
// 등급 표시 이름 (한글)
// ============================================

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
export function getDisplayRole(permissions: UserPermissions): string {
  if (permissions.adminRole) {
    return ROLE_DISPLAY_NAMES[permissions.adminRole];
  }
  if (permissions.tier) {
    return TIER_DISPLAY_NAMES[permissions.tier];
  }
  return '비회원';
}
