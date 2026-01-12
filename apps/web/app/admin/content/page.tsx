// app/admin/content/page.tsx
// Content Management Page (Channels, Threats, Economy)
// 권한별 기능 분리: 특별회원(등록), 관리자(수정), 소유자(삭제)

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { checkAdminAuth, getChannels, getThreatContents, getEconomyContents } from '../actions';
import { AdminLayout } from '../components/AdminLayout';
import { ChannelsSection } from './ChannelsSection';
import { ThreatsSection } from './ThreatsSection';
import { EconomySection } from './EconomySection';
import { checkPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function ContentPage({
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
  const activeTab = searchParams.tab || 'channels';

  // 권한 체크
  const canCreate = checkPermission(permissions.tier, permissions.adminRole, 'create', 'content');
  const canEdit = checkPermission(permissions.tier, permissions.adminRole, 'edit', 'content');
  const canDelete = checkPermission(permissions.tier, permissions.adminRole, 'delete', 'content');

  // Fetch data based on tab
  const [channels, threats, economyContents] = await Promise.all([
    activeTab === 'channels' ? getChannels() : Promise.resolve([]),
    activeTab === 'threats' ? getThreatContents() : Promise.resolve([]),
    activeTab === 'economy' ? getEconomyContents() : Promise.resolve([]),
  ]);

  return (
    <AdminLayout activeTab="content" permissions={permissions}>
      <div className="space-y-6">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-neutral-200 font-mono">CONTENT</h1>
            <p className="text-neutral-500 text-sm mt-1">
              채널, 위협 콘텐츠, 경제 콘텐츠 관리
            </p>
          </div>
          
          {/* 권한 안내 - 독립적으로 각 권한 뱃지 표시 */}
          <div className="hidden md:flex gap-2 text-xs">
            {canDelete && (
              <span className="px-2 py-1 bg-red-900/30 text-red-300 rounded">삭제 가능</span>
            )}
            {canEdit && (
              <span className="px-2 py-1 bg-amber-900/30 text-amber-300 rounded">수정 가능</span>
            )}
            {canCreate && (
              <span className="px-2 py-1 bg-emerald-900/30 text-emerald-300 rounded">등록 가능</span>
            )}
            {!canCreate && !canEdit && !canDelete && (
              <span className="px-2 py-1 bg-neutral-800 text-neutral-400 rounded">조회 전용</span>
            )}
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 w-fit">
          <SubTab href="/admin/content" active={activeTab === 'channels'}>
            📺 채널
          </SubTab>
          <SubTab href="/admin/content?tab=threats" active={activeTab === 'threats'}>
            ⚠️ 위협
          </SubTab>
          <SubTab href="/admin/content?tab=economy" active={activeTab === 'economy'}>
            💰 경제
          </SubTab>
        </div>

        {/* Content */}
        <Suspense fallback={<ContentSkeleton />}>
          {activeTab === 'channels' && (
            <ChannelsSection 
              channels={channels} 
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
          {activeTab === 'threats' && (
            <ThreatsSection 
              threats={threats} 
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
          {activeTab === 'economy' && (
            <EconomySection 
              contents={economyContents} 
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
        </Suspense>
      </div>
    </AdminLayout>
  );
}

// ============================================
// Sub Tab
// ============================================

function SubTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`px-4 py-2 text-sm rounded transition-colors ${
        active
          ? 'bg-neutral-700 text-neutral-200'
          : 'text-neutral-500 hover:text-neutral-300'
      }`}
    >
      {children}
    </a>
  );
}

// ============================================
// Content Skeleton
// ============================================

function ContentSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-neutral-900 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
