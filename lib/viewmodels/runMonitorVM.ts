/**
 * 실행 모니터 ViewModel — R1/R2. heatmapItems + selected 한 곳에서 변환.
 */
import type { HeatmapItem } from "@/lib/heatmap";

export interface RunMonitorVM {
  run: {
    run_id: string;
    title: string | null;
    status: string;
    created_at: string | null;
    started_at: string | null;
    defaults: { online_window_sec: number; device_grace_wait_ms: number; concurrency: number };
  };
  heatmapItems: HeatmapItem[];
  selected: {
    index: number;
    current_step?: { step_index: number; step_id: string; status: string; started_at: string };
    logs_tail?: string[];
    last_artifacts?: { kind: string; url: string; created_at: string }[];
  } | null;
}

type RunDetailRaw = {
  run?: RunMonitorVM["run"];
  heatmap?: { cols: number; tileSize: number; items: { index: number; online: boolean; activity?: string; progress?: { current: number; total: number }; last_seen?: string; last_error_message?: string }[] };
  selected?: RunMonitorVM["selected"];
};

function toHeatmapItem(raw: {
  index: number;
  online: boolean;
  activity?: string;
  progress?: { current: number; total: number };
  last_seen?: string;
  last_error_message?: string;
}): HeatmapItem {
  const activity = (raw.activity as HeatmapItem["activity"]) ?? "idle";
  return {
    index: raw.index,
    online: raw.online,
    activity: activity === "running" || activity === "waiting" || activity === "done" || activity === "error" ? activity : "idle",
    progress: raw.progress,
    last_seen: raw.last_seen,
    last_error_message: raw.last_error_message,
  };
}

export function toHeatmapItemsFromRun(raw: RunDetailRaw | null): HeatmapItem[] {
  if (!raw?.heatmap?.items) return [];
  return raw.heatmap.items.map(toHeatmapItem);
}

export function toRunMonitorVM(raw: RunDetailRaw | null): RunMonitorVM | null {
  if (!raw?.run) return null;
  return {
    run: raw.run,
    heatmapItems: toHeatmapItemsFromRun(raw),
    selected: raw.selected ?? null,
  };
}
