/**
 * DoAi.Me MVP Orchestration v1 — Nodes poll for pending runs (start-run)
 * Shared secret auth; returns runs for nodes to process
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const header = req.headers.get('X-Node-Auth');
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
      video_id,
      videos (
        youtube_video_id
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error(`[node_id=${node_id}] Pending runs fetch failed`, error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  const pending = (runs ?? []).map((r: { id: string; videos: { youtube_video_id: string } | { youtube_video_id: string }[] | null }) => {
    const v = Array.isArray(r.videos) ? r.videos[0] : r.videos;
    return {
      run_id: r.id,
      youtube_video_id: v?.youtube_video_id ?? '',
    };
  });

  return NextResponse.json({ pending });
}
