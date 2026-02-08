/**
 * DoAi.Me MVP Orchestration v1 — Backend
 * Creates run_id; nodes poll /api/nodes/pending-runs for start-run
 * No ALL execution from frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtube_video_id } = body;

    if (!youtube_video_id) {
      return NextResponse.json({ error: 'youtube_video_id required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert video
    const { data: video, error: videoErr } = await supabase
      .from('videos')
      .upsert({ youtube_video_id, title: body.title ?? null, channel_id: body.channel_id ?? null }, { onConflict: 'youtube_video_id' })
      .select('id')
      .single();

    if (videoErr || !video) {
      console.error('[run_id=create] Video upsert failed', videoErr);
      return NextResponse.json({ error: 'Video upsert failed' }, { status: 500 });
    }

    // Create run
    const { data: run, error: runErr } = await supabase
      .from('runs')
      .insert({ video_id: video.id, status: 'pending' })
      .select('id')
      .single();

    if (runErr || !run) {
      console.error('[run_id=create] Run insert failed', runErr);
      return NextResponse.json({ error: 'Run insert failed' }, { status: 500 });
    }

    const run_id = run.id;
    console.log(`[run_id=${run_id}] Created run; nodes poll /api/nodes/pending-runs for start-run`);

    return NextResponse.json({ run_id });
  } catch (err) {
    console.error('[run_id=create] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
