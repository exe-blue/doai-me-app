/**
 * DoAi.Me MVP Orchestration v1 — List runs (GET), Create run (POST)
 * Nodes poll /api/nodes/pending-runs for run_start payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    const supabase = createClient(url, key);
    const { data: runs, error } = await supabase
      .from('runs')
      .select('id, status, trigger, scope, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[runs] List failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      (runs ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        trigger: r.trigger ?? 'manual',
        target: r.scope ?? 'ALL',
        started: r.created_at
          ? new Date(r.created_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      }))
    );
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
    const {
      trigger = 'manual',
      scope = 'ALL',
      youtubeVideoId = null,
      workflow_id: workflowIdText = null,
      playbook_id: playbookIdParam = null,
      params: runParams = {},
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

    return NextResponse.json(
      { run_id, status: 'queued', created_at },
      { status: 201 }
    );
  } catch (err) {
    console.error('[runs] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
