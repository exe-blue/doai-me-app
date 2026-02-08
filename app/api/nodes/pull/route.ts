/**
 * DoAi.Me MVP — Nodes pull pending commands (run_start payload)
 * Hybrid: pull for run_start, callback for status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = token ?? req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

export async function GET(req: NextRequest) {
  if (!verifyNodeAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const node_id = req.nextUrl.searchParams.get('node_id');
  if (!node_id) {
    return NextResponse.json({ error: 'node_id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: runs, error } = await supabase
    .from('runs')
    .select(`
      id,
      trigger,
      scope,
      youtube_video_id,
      timeout_overrides,
      global_timeout_ms,
      workflows ( workflow_id )
    `)
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[node_id=%s] Pull failed', node_id, error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  const pending = (runs ?? []).map((r: Record<string, unknown>) => {
    const w = Array.isArray(r.workflows) ? r.workflows[0] : r.workflows;
    const workflow_id = (w as Record<string, string>)?.workflow_id ?? 'login_settings_screenshot_v1';
    return {
      run_id: r.id,
      trigger: r.trigger ?? 'manual',
      scope: r.scope ?? 'ALL',
      youtubeVideoId: r.youtube_video_id ?? null,
      workflow_id,
      timeoutOverrides: (r.timeout_overrides as Record<string, number>) ?? {},
      global_timeout_ms: r.global_timeout_ms ?? null,
    };
  });

  return NextResponse.json({ pending });
}
