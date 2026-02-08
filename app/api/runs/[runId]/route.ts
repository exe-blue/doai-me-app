/**
 * GET /api/runs/:runId — Run 모니터 (폴링). VM 형태 고정: run, heatmap.items[], selected{ index, current_step?, logs_tail[], last_artifacts[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { getRequestId, withRequestId } from '@/lib/requestId';
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
  Sentry.setTag('request_id', getRequestId(req));
  const { runId } = await params;
  const selectedIndex = req.nextUrl.searchParams.get('selected')
    ? Number(req.nextUrl.searchParams.get('selected'))
    : null;

  if (!runId) {
    return withRequestId(NextResponse.json({ error: 'runId required' }, { status: 400 }), req);
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
    return withRequestId(NextResponse.json({ error: 'Run not found' }, { status: 404 }), req);
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
      .select('step_index, step_id, status, started_at, finished_at, error_message')
      .eq('run_id', runId)
      .eq('device_index', idx)
      .order('step_index', { ascending: true });
    const stepsList = (steps ?? []) as { step_index: number; step_id: string; status: string; started_at: string | null; finished_at: string | null; error_message: string | null }[];
    const current = stepsList.length > 0 ? stepsList[stepsList.length - 1] : undefined;
    const logs_tail: string[] = stepsList
      .slice(-50)
      .map((s) => {
        const ts = s.started_at ? new Date(s.started_at).toISOString() : '—';
        const err = s.error_message ? ` | ${s.error_message}` : '';
        return `[${s.step_index}] ${s.step_id} ${s.status} ${ts}${err}`;
      });
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
      logs_tail,
      last_artifacts: (arts ?? []).map((a) => ({
        kind: (a as { kind: string }).kind ?? 'screenshot',
        url: (a as { public_url: string }).public_url ?? '',
        created_at: (a as { created_at: string }).created_at ?? '',
      })),
    };
  }

  return withRequestId(
    NextResponse.json({
      run,
      heatmap,
      ...(selected && { selected }),
    }),
    req
  );
}
