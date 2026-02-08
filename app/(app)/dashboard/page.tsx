"use client";

import Link from "next/link";
import { usePolling } from "@/lib/api";
import { POLL_INTERVAL_DASHBOARD_MS } from "@/lib/constants";
import { toDashboardVM } from "@/lib/viewmodels/dashboardVM";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { MiniMap } from "@/components/MiniMap";
import { HeatmapSkeleton } from "@/components/Skeleton";
import { ExternalLink } from "lucide-react";

export default function DashboardPage() {
  const { data: raw, loading } = usePolling<unknown>(
    "/api/dashboard?window=24h",
    POLL_INTERVAL_DASHBOARD_MS,
    { enabled: true }
  );

  const vm = toDashboardVM(raw as Parameters<typeof toDashboardVM>[0]);
  const k = vm?.kpis;
  const series = vm?.series;
  const todoList = vm?.todo ?? [];
  const miniHeatmapByNode = vm?.miniHeatmapByNode ?? [];
  const runsPerHour = series?.runs_per_hour ?? [];
  const maxStarted = Math.max(1, ...runsPerHour.map((x) => x.value));
  const currentOffline = k?.devices_offline ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          24시간 운영 요약 · 지금 당장 해야 할 일
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="실행 완료 (24h)" value={loading ? "—" : (k?.runs_succeeded ?? 0)} href="/runs?status=done&window=24h" status="done" />
        <KpiCard label="실패 (24h)" value={loading ? "—" : (k?.runs_failed ?? 0)} href="/runs?status=failed&window=24h" status="error" />
        <KpiCard label="실행 중 디바이스" value={loading ? "—" : (k?.devices_running ?? 0)} href="/runs?status=running" status="running" />
        <KpiCard label="Online / 전체" value={loading ? "—" : `${k?.devices_online ?? 0} / ${(k?.devices_online ?? 0) + (k?.devices_offline ?? 0)}`} href="/devices?filter=online" status="online" />
        <KpiCard label="Offline" value={loading ? "—" : (k?.devices_offline ?? 0)} href="/devices?filter=offline" status="offline" />
        <KpiCard label="즉시 조치 필요" value={loading ? "—" : (k?.needs_attention ?? 0)} href="/devices?filter=needs-attention" status="error" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="시간대별 실행량 (24h)" subtitle="0~23시 (started)">
          <div className="h-32 flex items-end gap-0.5">
            {(runsPerHour.length ? runsPerHour : Array.from({ length: 24 }, (_, i) => ({ t: `${i}:00`, value: 0, started: 0, succeeded: 0, failed: 0 }))).map((b, i) => (
              <div
                key={b.t ?? `hour-${i}`}
                className="flex-1 rounded-t bg-primary/30 min-h-1"
                style={{ height: `${(b.value / maxStarted) * 100}%` }}
                title={`${b.t} started: ${b.value}`}
              />
            ))}
          </div>
        </ChartCard>
        <ChartCard title="현재 Offline" subtitle="현재 시점 Offline 기기 수">
          <div className="h-32 flex items-center justify-center">
            <span className="text-3xl font-bold text-red-600 dark:text-red-400">
              {loading ? "—" : currentOffline}
            </span>
          </div>
        </ChartCard>
      </section>

      <section>
        <ChartCard title="기기 미니맵" subtitle="노드 선택 후 타일 클릭 시 기기 화면으로">
          {loading ? (
            <HeatmapSkeleton />
          ) : (
            <MiniMap nodes={miniHeatmapByNode} />
          )}
        </ChartCard>
      </section>

      <section>
        <ChartCard title="즉시 조치">
          <ul className="space-y-2">
            {todoList.map((item, i) => (
              <li key={`${item.kind}-${i}`} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <span className="text-sm">{item.count != null ? `${item.label} ${item.count}` : item.label}</span>
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  열기
                </Link>
              </li>
            ))}
            {todoList.length === 0 && !loading && <p className="text-sm text-muted-foreground">조치 항목 없음</p>}
          </ul>
        </ChartCard>
      </section>
    </div>
  );
}
