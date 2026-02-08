/**
 * 기기 페이지 ViewModel — R1/R2. Online/Offline·activity 계산은 여기만 (SSOT).
 * offline이면 activity를 idle로 강제.
 */
import type { HeatmapItem } from "@/lib/heatmap";

export interface DevicesVM {
  heatmapItems: HeatmapItem[];
  nodesSummary: { id: string; last_seen: string | null; last_error_message: string | null }[];
  now: string;
  online_window_sec: number;
}

type NodesStatusRaw = {
  now?: string;
  online_window_sec?: number;
  heatmap?: { items: { index: number; online: boolean; activity?: string; last_seen?: string; last_error_message?: string }[] };
  nodes?: { id: string; last_seen: string | null; last_error_message: string | null }[];
};

function toHeatmapItem(
  raw: { index: number; online: boolean; activity?: string; last_seen?: string; last_error_message?: string }
): HeatmapItem {
  const activity = raw.online ? ((raw.activity as HeatmapItem["activity"]) ?? "idle") : "idle";
  return {
    index: raw.index,
    online: raw.online,
    activity: activity === "running" || activity === "waiting" || activity === "done" || activity === "error" ? activity : "idle",
    last_seen: raw.last_seen ?? undefined,
    last_error_message: raw.last_error_message ?? undefined,
  };
}

export function toHeatmapItemsFromNodesStatus(raw: NodesStatusRaw | null): HeatmapItem[] {
  if (!raw?.heatmap?.items) return [];
  return raw.heatmap.items.map(toHeatmapItem);
}

export function toDevicesVM(raw: NodesStatusRaw | null): DevicesVM | null {
  if (!raw) return null;
  return {
    heatmapItems: toHeatmapItemsFromNodesStatus(raw),
    nodesSummary: raw.nodes ?? [],
    now: raw.now ?? new Date().toISOString(),
    online_window_sec: raw.online_window_sec ?? 30,
  };
}
