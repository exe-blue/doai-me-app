// app/admin/members/page.tsx
// 회원 관리 페이지 - 관리자/소유자 전용
// 소유자만 등급 변경 가능

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { checkAdminAuth, getMembers, getAdminUsers } from '../actions';
import { AdminLayout } from '../components/AdminLayout';
import { MembersTable } from './MembersTable';
import { AdminUsersTable } from './AdminUsersTable';
import { checkPermission } from '@/lib/auth/permissions';
import { Users, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  // Auth check (SSR)
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    redirect('/admin/unauthorized');
  }

  const { permissions } = auth;
  
  // 회원 관리 페이지 접근 권한 체크
  const canViewMembers = checkPermission(permissions.tier, permissions.adminRole, 'view', 'members');
  if (!canViewMembers) {
    redirect('/admin/unauthorized');
  }

  const canEditMembers = checkPermission(permissions.tier, permissions.adminRole, 'edit', 'members');
  const activeTab = searchParams.tab || 'members';

  // Fetch data
  const [members, adminUsers] = await Promise.all([
    activeTab === 'members' ? getMembers() : Promise.resolve([]),
    activeTab === 'admins' ? getAdminUsers() : Promise.resolve([]),
  ]);

  return (
    <AdminLayout activeTab="members" permissions={permissions}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-neutral-200 font-mono">MEMBERS</h1>
            <p className="text-neutral-500 text-sm mt-1">
              회원 등급 및 관리자 역할 관리
            </p>
          </div>
          
          {/* 소유자 전용 안내 */}
          {!canEditMembers && (
            <div className="px-3 py-1.5 bg-amber-900/30 text-amber-300 rounded text-xs">
              조회 전용 (등급 변경은 소유자만 가능)
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 w-fit">
          <TabLink 
            href="/admin/members" 
            active={activeTab === 'members'}
            icon={<Users className="w-4 h-4" />}
          >
            일반 회원
          </TabLink>
          <TabLink 
            href="/admin/members?tab=admins" 
            active={activeTab === 'admins'}
            icon={<Shield className="w-4 h-4" />}
          >
            관리자
          </TabLink>
        </div>

        {/* Content */}
        <Suspense fallback={<TableSkeleton />}>
          {activeTab === 'members' && (
            <MembersTable members={members} canEdit={canEditMembers} />
          )}
          {activeTab === 'admins' && (
            <AdminUsersTable adminUsers={adminUsers} canEdit={canEditMembers} currentUserId={permissions.userId} />
          )}
        </Suspense>
      </div>
    </AdminLayout>
  );
}

// ============================================
// Tab Link
// ============================================

function TabLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors ${
        active
          ? 'bg-neutral-700 text-neutral-200'
          : 'text-neutral-500 hover:text-neutral-300'
      }`}
    >
      {icon}
      {children}
    </a>
  );
}

// ============================================
// Table Skeleton
// ============================================

function TableSkeleton() {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
