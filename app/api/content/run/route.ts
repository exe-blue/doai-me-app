/**
 * POST /api/content/run — create run from content (video), link content.run_id
 * Body: { content_id, workflow_id?, params?, target?: { scope } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const content_id = body.content_id as string | undefined;
    const workflow_id = (body.workflow_id as string) ?? 'demo_20steps_v1';
    const params = (body.params as Record<string, unknown>) ?? {};
    const scope = (body.target?.scope as string) ?? 'ALL';

    if (!content_id || typeof content_id !== 'string') {
      return NextResponse.json({ error: 'content_id required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: content, error: contentErr } = await supabase
      .from('contents')
      .select('id, content_id, channel_id')
      .eq('provider', 'youtube')
      .eq('content_id', content_id)
      .single();

    if (contentErr || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Resolve workflow_id to internal id
    const { data: workflow, error: wfErr } = await supabase
      .from('workflows')
      .select('id')
      .eq('workflow_id', workflow_id)
      .single();

    if (wfErr || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 400 });
    }

    const { data: run, error: runErr } = await supabase
      .from('runs')
      .insert({
        video_id: null,
        status: 'queued',
        trigger: 'manual',
        scope,
        youtube_video_id: content_id,
        workflow_id: (workflow as { id: string }).id,
        playbook_id: null,
        params: Object.keys(params).length ? params : {},
      })
      .select('id, created_at')
      .single();

    if (runErr || !run) {
      console.error('[content/run] Run insert failed', runErr);
      return NextResponse.json({ error: 'Run insert failed' }, { status: 500 });
    }

    await supabase
      .from('contents')
      .update({ run_id: run.id })
      .eq('id', (content as { id: string }).id);

    return NextResponse.json(
      {
        run_id: run.id,
        status: 'queued',
        created_at: new Date((run as { created_at: string }).created_at).getTime(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[content/run] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
