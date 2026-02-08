/**
 * 대시보드 ViewModel — R1: API raw → 고정 형태만 UI에 전달
 */
import type { HeatmapItem } from "@/lib/heatmap";

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
  miniHeatmapItems: HeatmapItem[];
}

type DashboardRaw = {
  kpis?: DashboardVM["kpis"];
  series?: {
    runs_per_hour?: { t: string; started: number; succeeded: number; failed: number }[];
    offline_per_hour?: { t: string; offline: number }[];
  };
  todo?: DashboardVM["todo"];
  mini_heatmap?: { items: { index: number; online: boolean; activity?: string }[] };
};

function toHeatmapItem(raw: { index: number; online: boolean; activity?: string }): HeatmapItem {
  const activity = (raw.activity as HeatmapItem["activity"]) ?? "idle";
  return {
    index: raw.index,
    online: raw.online,
    activity: activity === "running" || activity === "waiting" || activity === "done" || activity === "error" ? activity : "idle",
  };
}

export function toDashboardVM(raw: DashboardRaw | null): DashboardVM | null {
  if (!raw?.kpis) return null;
  const runsPerHour = raw.series?.runs_per_hour ?? [];
  const offlinePerHour = raw.series?.offline_per_hour ?? [];
  return {
    kpis: raw.kpis,
    series: {
      runs_per_hour: runsPerHour.map((x) => ({ ...x, value: x.started })),
      offline_per_hour: offlinePerHour.map((x) => ({ t: x.t, value: x.offline })),
    },
    todo: raw.todo ?? [],
    miniHeatmapItems: (raw.mini_heatmap?.items ?? []).map(toHeatmapItem),
  };
}
