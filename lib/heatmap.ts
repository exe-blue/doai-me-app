/**
 * P0 공통: HeatmapItem 형식 (모든 화면 재사용)
 * /devices, /runs/[runId], 대시보드 미니맵 동일 구조
 */
export type HeatmapActivity = 'idle' | 'running' | 'done' | 'error' | 'waiting';

export interface HeatmapItem {
  index: number;
  online: boolean;
  activity?: HeatmapActivity;
  progress?: { current: number; total: number };
  label?: string;
  last_seen?: string;
  last_error_message?: string;
}

export const HEATMAP_COLS = 10;
export const HEATMAP_TILE_SIZE = 36;
export const HEATMAP_MINI_TILE_SIZE = 24;

function runStatusToActivity(status: string): HeatmapActivity {
  if (status === 'running') return 'running';
  if (status === 'queued') return 'waiting';
  if (status === 'succeeded' || status === 'completed' || status === 'completed_with_errors') return 'done';
  if (status === 'failed' || status === 'stopped') return 'error';
  return 'idle';
}

export function deviceToHeatmapItem(
  index: number,
  online: boolean,
  last_seen?: string | null,
  last_error_message?: string | null,
  activity?: HeatmapActivity,
  progress?: { current: number; total: number }
): HeatmapItem {
  const item: HeatmapItem = { index, online };
  if (last_seen) item.last_seen = last_seen;
  if (last_error_message) item.last_error_message = last_error_message;
  if (activity) item.activity = activity;
  else item.activity = 'idle';
  if (progress) item.progress = progress;
  return item;
}

export function runDeviceStateToHeatmapItem(
  device_index: number,
  online: boolean,
  status: string,
  current_step_index?: number,
  total_steps?: number,
  last_seen?: string | null,
  last_error_message?: string | null
): HeatmapItem {
  const activity = runStatusToActivity(status);
  const item: HeatmapItem = { index: device_index, online, activity };
  if (last_seen) item.last_seen = last_seen;
  if (last_error_message) item.last_error_message = last_error_message;
  if (typeof current_step_index === 'number' && typeof total_steps === 'number' && total_steps > 0) {
    item.progress = { current: current_step_index, total: total_steps };
  }
  return item;
}
