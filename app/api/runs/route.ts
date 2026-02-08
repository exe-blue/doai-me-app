/**
 * DoAi.Me MVP Orchestration v1 — List runs (GET), Create run (POST)
 * Nodes poll /api/nodes/pending-runs for run_start payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get('status') || undefined;
    const windowParam = searchParams.get('window') || undefined;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    const supabase = createClient(url, key);

    let query = supabase
      .from('runs')
      .select('id, status, trigger, scope, created_at, started_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (windowParam === '24h' || windowParam === '1h') {
      const hours = windowParam === '1h' ? 1 : 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }
    if (statusFilter === 'running') query = query.eq('status', 'running');
    else if (statusFilter === 'failed' || statusFilter === 'error') query = query.eq('status', 'failed');
    else if (statusFilter === 'succeeded' || statusFilter === 'done') query = query.in('status', ['completed', 'completed_with_errors']);
    else if (statusFilter === 'queued') query = query.eq('status', 'queued');
    else if (statusFilter === 'stopped') query = query.eq('status', 'stopped');

    const { data: runs, error } = await query;
    if (error) {
      console.error('[runs] List failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const runIds = (runs ?? []).map((r) => r.id);
    const countsByRun: Record<string, { running: number; done: number; error: number; waiting: number; skipped_offline: number }> = {};
    for (const id of runIds) {
      countsByRun[id] = { running: 0, done: 0, error: 0, waiting: 0, skipped_offline: 0 };
    }

    if (runIds.length > 0) {
      const { data: tasks } = await supabase
        .from('device_tasks')
        .select('run_id, status')
        .in('run_id', runIds);
      for (const t of tasks ?? []) {
        const r = (t as { run_id: string; status: string }).run_id;
        if (!countsByRun[r]) continue;
        const c = countsByRun[r];
        if ((t as { status: string }).status === 'running') c.running++;
        else if ((t as { status: string }).status === 'completed') c.done++;
        else if ((t as { status: string }).status === 'failed') c.error++;
        else if ((t as { status: string }).status === 'pending' || (t as { status: string }).status === 'queued') c.waiting++;
      }
      const { data: rds } = await supabase.from('run_device_states').select('run_id, status').in('run_id', runIds);
      for (const row of rds ?? []) {
        const r = (row as { run_id: string; status: string }).run_id;
        if (!countsByRun[r]) continue;
        const c = countsByRun[r];
        const s = (row as { status: string }).status;
        if (s === 'running') c.running++;
        else if (s === 'succeeded') c.done++;
        else if (s === 'failed' || s === 'stopped') c.error++;
        else if (s === 'queued') c.waiting++;
      }
    }

    const items = (runs ?? []).map((r) => ({
      run_id: r.id,
      title: (r as { title?: string }).title ?? null,
      status: r.status,
      created_at: (r.created_at as string) ?? null,
      started_at: (r.started_at as string) ?? null,
      counts: countsByRun[r.id] ?? { running: 0, done: 0, error: 0, waiting: 0, skipped_offline: 0 },
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[runs] GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

const STEP_TIMEOUT_MIN_MS = 5_000;
const STEP_TIMEOUT_MAX_MS = 600_000;
const GLOBAL_TIMEOUT_MIN_MS = 60_000;
const GLOBAL_TIMEOUT_MAX_MS = 1_800_000;

function clampStepTimeout(ms: number): number {
  return Math.max(STEP_TIMEOUT_MIN_MS, Math.min(STEP_TIMEOUT_MAX_MS, ms));
}

function clampGlobalTimeout(ms: number): number {
  return Math.max(GLOBAL_TIMEOUT_MIN_MS, Math.min(GLOBAL_TIMEOUT_MAX_MS, ms));
}

type ResolvedRunSource = { workflow_id: string | null; playbook_id: string | null };

async function resolveWorkflowOrPlaybook(
  supabase: SupabaseClient,
  playbookIdParam: string | null,
  workflowIdText: string | null
): Promise<ResolvedRunSource> {
    if (playbookIdParam) {
    const { data: pb, error: pbErr } = await supabase
      .from('playbooks')
      .select('id')
      .eq('id', playbookIdParam)
      .single();
    if (pbErr || !pb) throw new Error('Playbook not found');
    const playbookId = (pb as { id: string }).id;
    return { workflow_id: null, playbook_id: playbookId };
  }
  const workflowId = workflowIdText ?? 'login_settings_screenshot_v1';
  const { data: workflow, error: wfErr } = await supabase
    .from('workflows')
    .select('id')
    .eq('workflow_id', workflowId)
    .single();
  if (wfErr || !workflow) throw new Error('Workflow not found');
  const wfId = (workflow as { id: string }).id;
  return { workflow_id: wfId, playbook_id: null };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode === 'workflow' ? 'workflow' : 'playbook';
    const target = body.target && typeof body.target === 'object' ? body.target : {};
    const scope = target.scope ?? body.scope ?? 'ALL';
    const defaults = body.defaults && typeof body.defaults === 'object' ? body.defaults : {};
    const {
      trigger = 'manual',
      youtubeVideoId = null,
      workflow_id: workflowIdText = body.workflow_id ?? null,
      playbook_id: playbookIdParam = body.playbook_id ?? null,
      params: runParams = body.params ?? {},
      timeoutOverrides = {},
      globalTimeoutMs,
    } = body;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    const supabase = createClient(url, key);

    let workflow_id: string | null;
    let playbook_id: string | null;
    try {
      const resolved = await resolveWorkflowOrPlaybook(supabase, playbookIdParam, workflowIdText);
      workflow_id = resolved.workflow_id;
      playbook_id = resolved.playbook_id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid run source';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let video_id: string | null = null;
    if (youtubeVideoId) {
      const { data: video, error: videoErr } = await supabase
        .from('videos')
        .upsert(
          {
            youtube_video_id: youtubeVideoId,
            title: body.title ?? null,
            channel_id: body.channel_id ?? null,
          },
          { onConflict: 'youtube_video_id' }
        )
        .select('id')
        .single();
      if (videoErr || !video) {
        console.error('[runs] Video upsert failed', videoErr);
        return NextResponse.json({ error: 'Video upsert failed' }, { status: 500 });
      }
      video_id = video.id;
    }

    const normalizedOverrides: Record<string, number> = {};
    for (const [key, val] of Object.entries(timeoutOverrides)) {
      if (typeof val === 'number') normalizedOverrides[key] = clampStepTimeout(val);
    }
    const global_ms =
      typeof globalTimeoutMs === 'number' ? clampGlobalTimeout(globalTimeoutMs) : undefined;

    const paramsPayload =
      typeof runParams === 'object' && runParams !== null && !Array.isArray(runParams)
        ? runParams
        : {};

    const { data: run, error: runErr } = await supabase
      .from('runs')
      .insert({
        video_id,
        status: 'queued',
        trigger,
        scope,
        youtube_video_id: youtubeVideoId ?? null,
        workflow_id,
        playbook_id,
        params: Object.keys(paramsPayload).length ? paramsPayload : null,
        timeout_overrides: Object.keys(normalizedOverrides).length ? normalizedOverrides : null,
        global_timeout_ms: global_ms ?? null,
        target: Object.keys(target).length ? target : {},
      })
      .select('id, created_at')
      .single();

    if (runErr || !run) {
      console.error('[runs] Run insert failed', runErr);
      return NextResponse.json({ error: 'Run insert failed' }, { status: 500 });
    }

    const run_id = run.id;
    const created_at = new Date(run.created_at).getTime();
    console.log(`[run_id=${run_id}] Created run; workflow_id=${workflow_id ?? '—'}, playbook_id=${playbook_id ?? '—'}`);

    return NextResponse.json({ run_id }, { status: 201 });
  } catch (err) {
    console.error('[runs] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
