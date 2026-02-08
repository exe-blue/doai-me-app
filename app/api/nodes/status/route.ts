/**
 * GET /api/nodes/status — /devices 폴링(3s). heatmap.items[] + nodes[]
 * POST — Node reports per-device task status (X-Node-Auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { HEATMAP_COLS, HEATMAP_TILE_SIZE, deviceToHeatmapItem } from '@/lib/heatmap';

const ONLINE_WINDOW_SEC = 30;

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: devices } = await supabase
    .from('devices')
    .select('id, index_no, device_id, node_id, last_seen_at, last_error_message')
    .order('index_no', { ascending: true, nullsFirst: false });

  const threshold = new Date(Date.now() - ONLINE_WINDOW_SEC * 1000).toISOString();
  const items: { index: number; online: boolean; node_id?: string; last_seen?: string; last_error_message?: string }[] = [];
  let rowIndex = 1;
  for (const d of devices ?? []) {
    const index = (d as { index_no: number | null }).index_no ?? rowIndex++;
    const lastSeen = (d as { last_seen_at: string | null }).last_seen_at;
    const online = lastSeen != null && lastSeen >= threshold;
    const nodeId = (d as { node_id: string | null }).node_id ?? undefined;
    const item = deviceToHeatmapItem(index, online, lastSeen, (d as { last_error_message: string | null }).last_error_message);
    items.push({ ...item, node_id: nodeId });
  }

  const { data: heartbeats } = await supabase
    .from('node_heartbeats')
    .select('node_id, updated_at, payload')
    .order('node_id');
  const latestRunnerVersion = process.env.LATEST_RUNNER_VERSION ?? '0.1.0';
  const nodes = (heartbeats ?? []).map((h) => {
    const p = (h as { payload?: Record<string, unknown> }).payload ?? {};
    const runnerVersion = (p.runner_version as string) ?? '';
    const needsUpdate = runnerVersion !== '' && runnerVersion !== latestRunnerVersion;
    return {
      id: (h as { node_id: string }).node_id,
      last_seen: (h as { updated_at: string }).updated_at,
      last_error_message: (p.last_error_message as string) ?? null,
      runner_version: runnerVersion || null,
      needs_update: needsUpdate,
    };
  });

  return NextResponse.json({
    now: new Date().toISOString(),
    online_window_sec: ONLINE_WINDOW_SEC,
    heatmap: {
      cols: HEATMAP_COLS,
      tileSize: HEATMAP_TILE_SIZE,
      items,
    },
    nodes,
    runner: { latest_version: latestRunnerVersion },
  });
}

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const header = req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

export async function POST(req: NextRequest) {
  if (!verifyNodeAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { run_id, node_id, device_serial, status, device_task_id } = body;

  if (!run_id || !node_id || !device_serial || !status) {
    return NextResponse.json({ error: 'run_id, node_id, device_serial, status required' }, { status: 400 });
  }

  console.log(`[run_id=${run_id} node_id=${node_id} device_serial=${device_serial}] Status: ${status}`);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (device_task_id) {
    const { error } = await supabase
      .from('device_tasks')
      .update({
        status,
        node_id,
        ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
        ...(status === 'completed' || status === 'failed' ? { finished_at: new Date().toISOString() } : {}),
      })
      .eq('id', device_task_id);

    if (error) {
      console.error(`[run_id=${run_id} node_id=${node_id} device_serial=${device_serial}] Update failed`, error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
