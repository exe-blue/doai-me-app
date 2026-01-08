// app/admin/history/page.tsx
// 히스토리 전체 조회 페이지

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { checkAdminAuth } from '../actions';
import { AdminLayout } from '../components/AdminLayout';
import { HistoryDashboard } from './HistoryDashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HistoryPage() {
  // Auth check (SSR)
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    redirect('/admin/unauthorized');
  }

  return (
    <AdminLayout activeTab="history">
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryDashboard />
      </Suspense>
    </AdminLayout>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-neutral-900 border border-neutral-800 rounded-lg animate-pulse" />
      <div className="h-[600px] bg-neutral-900 border border-neutral-800 rounded-lg animate-pulse" />
    </div>
  );
}
