/**
 * DoAi.Me MVP — Nodes pull: single atomic transaction (lease + 1 job).
 * Design: FOR UPDATE SKIP LOCKED, lease TTL, server-side probability decision.
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { withRequestId } from '@/lib/requestId';

const ONLINE_WINDOW_SEC = 30;
const LEASE_SEC = 30;
/** 노드 동시 실행 1개 고정 (한 번에 한 job만 할당) */
const MAX_JOBS = 1;

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = token ?? req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

function isoNow(): string {
  return new Date().toISOString();
}

/** Deterministic decision: executed if u < probability else skipped. Seed = run_id|device_index|step_id. */
function decide(
  runId: string,
  deviceIndex: number,
  stepId: string,
  probability: number
): 'executed' | 'skipped' {
  const seed = `${runId}|${deviceIndex}|${stepId}`;
  const h = createHash('sha256').update(seed).digest('hex');
  const uInt = Number.parseInt(h.slice(0, 16), 16);
  const u = (uInt % 1_000_000) / 1_000_000;
  return u < probability ? 'executed' : 'skipped';
}

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  Sentry.setTag('request_id', requestId);

  if (!verifyNodeAuth(req)) {
    return withRequestId(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), req);
  }

  const node_id = req.nextUrl.searchParams.get('node_id');
  if (!node_id) {
    return withRequestId(NextResponse.json({ error: 'node_id required' }, { status: 400 }), req);
  }
  Sentry.setTag('node_id', node_id);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return withRequestId(NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 }), req);
  }
  const supabase = createClient(url, key);

  // 1) Atomic assign: pick one candidate + issue lease (RPC)
  const { data: rows, error: rpcError } = await supabase.rpc('nodes_pull_assign', {
    p_node_id: node_id,
    p_online_window_sec: ONLINE_WINDOW_SEC,
    p_lease_sec: LEASE_SEC,
  });

  if (rpcError) {
    console.error('[nodes/pull] RPC failed', node_id, rpcError);
    return withRequestId(NextResponse.json({ error: 'Assign failed' }, { status: 500 }), req);
  }

  const candidate = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!candidate) {
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  const run_id = candidate.run_id as string;
  const device_index = candidate.device_index as number;
  const current_step_index = candidate.current_step_index as number;
  const leaseToken = (candidate.lease_token as string | null) ?? '';

  // 2) Run: fetch + queued → running
  const { data: run, error: runErr } = await supabase
    .from('runs')
    .select('id, playbook_id, workflow_id, status, params, target, timeout_overrides, global_timeout_ms')
    .eq('id', run_id)
    .single();

  if (runErr || !run) {
    console.error('[nodes/pull] Run fetch failed', run_id, runErr);
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  const runRow = run as {
    id: string;
    playbook_id: string | null;
    workflow_id: string | null;
    status: string;
    params: Record<string, unknown> | null;
    target: Record<string, unknown> | null;
    timeout_overrides: Record<string, number> | null;
    global_timeout_ms: number | null;
  };

  if (runRow.status === 'queued') {
    await supabase
      .from('runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', run_id);
  }

  // 3) Device
  const { data: device, error: devErr } = await supabase
    .from('devices')
    .select('index_no, device_id, runtime_handle, node_id')
    .eq('index_no', device_index)
    .single();

  if (devErr || !device) {
    console.error('[nodes/pull] Device fetch failed', device_index, devErr);
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  // 4) Step resolve: playbook_steps by playbook_id, order by sort_order, [current_step_index]
  const playbook_id = runRow.playbook_id;
  if (!playbook_id) {
    // Workflow runs: P0 no-op (return no job so node doesn't get workflow job from this path)
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  const { data: steps, error: stepsErr } = await supabase
    .from('playbook_steps')
    .select('id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability, params')
    .eq('playbook_id', playbook_id)
    .order('sort_order', { ascending: true });

  if (stepsErr || !steps || steps.length === 0) {
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  const stepRow = steps[current_step_index] as
    | {
        id: string;
        command_asset_id: string;
        sort_order: number;
        timeout_ms: number | null;
        on_failure: string;
        retry_count: number;
        probability: number;
        params: Record<string, unknown> | null;
      }
    | undefined;

  if (!stepRow) {
    // No more steps: mark device done
    await supabase
      .from('run_device_states')
      .update({ status: 'succeeded', updated_at: isoNow() })
      .eq('run_id', run_id)
      .eq('device_index', device_index);
    return withRequestId(NextResponse.json({ now: isoNow(), jobs: [] }), req);
  }

  const step_id = stepRow.command_asset_id;
  const probability = typeof stepRow.probability === 'number' ? Math.max(0, Math.min(1, stepRow.probability)) : 1;

  // 5) Command asset for step_type (kind), title, and script (runner용)
  const { data: asset } = await supabase
    .from('command_assets')
    .select('kind, title, inline_content')
    .eq('id', step_id)
    .single();

  const step_type = (asset as { kind: string } | null)?.kind ?? 'adb';
  const step_title = (asset as { title: string } | null)?.title ?? null;
  const step_command = (asset as { inline_content: string | null } | null)?.inline_content ?? null;

  // 6) Server-side decision
  const decision = decide(run_id, device_index, step_id, probability);

  // 7) Pre-insert run_steps (queued) so "assigned step" is recorded even if node never callbacks
  const { error: stepInsertErr } = await supabase.from('run_steps').insert({
    run_id,
    device_index,
    step_index: current_step_index,
    step_id,
    step_type,
    status: 'queued',
    probability,
    decision,
    created_at: isoNow(),
  });
  if (stepInsertErr?.code === '23505') {
    // Unique violation: row already exists (e.g. retry), ignore
  } else if (stepInsertErr) {
    console.error('[nodes/pull] run_steps insert failed', stepInsertErr);
  }

  // 8) Build job
  const dev = device as { device_id: string; runtime_handle: string | null };
  const job = {
    run_id,
    device_index,
    device_id: dev.device_id,
    runtime_handle: dev.runtime_handle ?? null,
    step_index: current_step_index,
    step_id,
    step_type,
    step_title,
    step_command: step_command ?? undefined,
    decision,
    probability,
    lease: { token: leaseToken },
    params: runRow.params ?? {},
    timeout_ms: stepRow.timeout_ms ?? null,
    on_failure: stepRow.on_failure,
    retry_count: stepRow.retry_count,
    step_params: stepRow.params ?? {},
    timeout_overrides: runRow.timeout_overrides ?? {},
    global_timeout_ms: runRow.global_timeout_ms ?? null,
  };

  return withRequestId(NextResponse.json({ now: isoNow(), jobs: [job] }), req);
}
