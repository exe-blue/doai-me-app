/**
 * DoAi.Me MVP Orchestration v1 — Create run (workflow_id, timeoutOverrides, target)
 * Nodes poll /api/nodes/pending-runs for run_start payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      trigger = 'manual',
      scope = 'ALL',
      youtubeVideoId = null,
      workflow_id: workflowIdText = 'login_settings_screenshot_v1',
      timeoutOverrides = {},
      globalTimeoutMs,
    } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const { data: workflow, error: wfErr } = await supabase
      .from('workflows')
      .select('id')
      .eq('workflow_id', workflowIdText)
      .single();

    if (wfErr || !workflow) {
      console.error('[runs] Workflow not found', workflowIdText, wfErr);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 400 });
    }

    const normalizedOverrides: Record<string, number> = {};
    for (const [key, val] of Object.entries(timeoutOverrides)) {
      if (typeof val === 'number') normalizedOverrides[key] = clampStepTimeout(val);
    }
    const global_ms =
      typeof globalTimeoutMs === 'number' ? clampGlobalTimeout(globalTimeoutMs) : undefined;

    const { data: run, error: runErr } = await supabase
      .from('runs')
      .insert({
        video_id,
        status: 'queued',
        trigger,
        scope,
        youtube_video_id: youtubeVideoId ?? null,
        workflow_id: workflow.id,
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
    console.log(`[run_id=${run_id}] Created run; workflow=${workflowIdText}`);

    return NextResponse.json(
      { run_id, status: 'queued', created_at },
      { status: 201 }
    );
  } catch (err) {
    console.error('[runs] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
