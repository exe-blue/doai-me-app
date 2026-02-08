/**
 * 대시보드 ViewModel — R1: API raw → 고정 형태만 UI에 전달
 * mini_heatmap: 노드 단위, 슬롯 100개 정규화.
 */
import type { HeatmapItem } from "@/lib/heatmap";
import { normalizeToSlots } from "@/lib/heatmap";

export interface MiniHeatmapNode {
  node_id: string;
  label: string;
  items: HeatmapItem[];
  counts: { online: number; offline: number };
}

export interface DashboardVM {
  kpis: {
    runs_succeeded: number;
    runs_failed: number;
    devices_running: number;
    devices_online: number;
    devices_offline: number;
    needs_attention: number;
  };
  series: {
    runs_per_hour: { t: string; value: number; started: number; succeeded: number; failed: number }[];
    offline_per_hour: { t: string; value: number }[];
  };
  todo: { kind: string; count?: number; label: string; href: string }[];
  miniHeatmapByNode: MiniHeatmapNode[];
  runner?: {
    latest_version: string;
    update_needed_count: number;
    download_url: string | null;
  };
}

type DashboardRaw = {
  kpis?: DashboardVM["kpis"];
  series?: {
    runs_per_hour?: { t: string; started: number; succeeded: number; failed: number }[];
    offline_per_hour?: { t: string; offline: number }[];
  };
  todo?: DashboardVM["todo"];
  mini_heatmap?: {
    slot?: { cols: number; rows: number; perNode: number };
    nodes?: {
      node_id: string;
      label: string;
      items: { index: number; online: boolean }[];
      counts: { online: number; offline: number };
    }[];
  };
  runner?: {
    latest_version: string;
    update_needed_count: number;
    download_url: string | null;
  };
};

export function toDashboardVM(raw: DashboardRaw | null): DashboardVM | null {
  if (!raw?.kpis) return null;
  const runsPerHour = raw.series?.runs_per_hour ?? [];
  const offlinePerHour = raw.series?.offline_per_hour ?? [];
  const miniNodes = raw.mini_heatmap?.nodes ?? [];
  const miniHeatmapByNode: MiniHeatmapNode[] = miniNodes.map((n) => ({
    node_id: n.node_id,
    label: n.label,
    items: normalizeToSlots(n.items, 100),
    counts: n.counts,
  }));
  return {
    kpis: raw.kpis,
    series: {
      runs_per_hour: runsPerHour.map((x) => ({ ...x, value: x.started })),
      offline_per_hour: offlinePerHour.map((x) => ({ t: x.t, value: x.offline })),
    },
    todo: raw.todo ?? [],
    miniHeatmapByNode,
    runner: raw.runner,
  };
}
