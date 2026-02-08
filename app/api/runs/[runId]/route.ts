/**
 * GET /api/runs/:runId — Run 모니터 (폴링 1.5s). run + heatmap + selected
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  HEATMAP_COLS,
  HEATMAP_TILE_SIZE,
  runDeviceStateToHeatmapItem,
} from '@/lib/heatmap';

const ONLINE_WINDOW_SEC = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const selectedIndex = req.nextUrl.searchParams.get('selected')
    ? Number(req.nextUrl.searchParams.get('selected'))
    : null;

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: runRow, error: runErr } = await supabase
    .from('runs')
    .select('id, status, trigger, scope, created_at, started_at, finished_at, target, workflow_id, playbook_id')
    .eq('id', runId)
    .single();

  if (runErr || !runRow) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const run = {
    run_id: runRow.id,
    title: (runRow as { title?: string }).title ?? null,
    status: runRow.status,
    created_at: (runRow.created_at as string) ?? null,
    started_at: (runRow.started_at as string) ?? null,
    defaults: {
      online_window_sec: ONLINE_WINDOW_SEC,
      device_grace_wait_ms: 15000,
      concurrency: 1,
    },
  };

  const { data: deviceStates } = await supabase
    .from('run_device_states')
    .select('device_index, status, current_step_index, last_seen, last_error_message')
    .eq('run_id', runId)
    .order('device_index');

  const deviceIndexes = (deviceStates ?? []).map((d) => (d as { device_index: number }).device_index);
  const onlineByIndex: Record<number, boolean> = {};
  if (deviceIndexes.length > 0) {
    const { data: devs } = await supabase
      .from('devices')
      .select('index_no, last_seen_at')
      .in('index_no', deviceIndexes);
    const threshold = new Date(Date.now() - ONLINE_WINDOW_SEC * 1000).toISOString();
    for (const d of devs ?? []) {
      const idx = (d as { index_no: number }).index_no;
      const last = (d as { last_seen_at: string | null }).last_seen_at;
      onlineByIndex[idx] = last != null && last >= threshold;
    }
  }

  const totalSteps = 0; // could be from playbook/workflow step count
  const heatmapItems = (deviceStates ?? []).map((s) => {
    const d = s as { device_index: number; status: string; current_step_index?: number; last_seen?: string; last_error_message?: string };
    return runDeviceStateToHeatmapItem(
      d.device_index,
      onlineByIndex[d.device_index] ?? false,
      d.status,
      d.current_step_index,
      totalSteps || undefined,
      d.last_seen,
      d.last_error_message
    );
  });

  const heatmap = {
    cols: HEATMAP_COLS,
    tileSize: HEATMAP_TILE_SIZE,
    items: heatmapItems,
  };

  let selected: {
    index: number;
    current_step?: { step_index: number; step_id: string; status: string; started_at: string };
    logs_tail?: string[];
    last_artifacts?: { kind: string; url: string; created_at: string }[];
  } | null = null;

  const idx = selectedIndex ?? heatmapItems.find((i) => i.activity === 'running')?.index ?? heatmapItems[0]?.index;
  if (idx != null && !Number.isNaN(idx)) {
    const { data: steps } = await supabase
      .from('run_steps')
      .select('step_index, step_id, status, started_at')
      .eq('run_id', runId)
      .eq('device_index', idx)
      .order('step_index', { ascending: false })
      .limit(1);
    const current = (steps ?? [])[0] as { step_index: number; step_id: string; status: string; started_at: string } | undefined;
    const { data: arts } = await supabase
      .from('artifacts')
      .select('kind, public_url, created_at')
      .eq('run_id', runId)
      .eq('device_index', idx)
      .order('created_at', { ascending: false })
      .limit(5);
    selected = {
      index: idx,
      ...(current && {
        current_step: {
          step_index: current.step_index,
          step_id: current.step_id,
          status: current.status,
          started_at: current.started_at ?? '',
        },
      }),
      logs_tail: [],
      last_artifacts: (arts ?? []).map((a) => ({
        kind: (a as { kind: string }).kind ?? 'screenshot',
        url: (a as { public_url: string }).public_url ?? '',
        created_at: (a as { created_at: string }).created_at ?? '',
      })),
    };
  }

  return NextResponse.json({
    run,
    heatmap,
    ...(selected && { selected }),
  });
}
