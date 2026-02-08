/**
 * POST /api/channels/:id/sync — YouTube search.list, upsert contents.
 * safety_margin 10분 적용 (유실 방지).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncOneChannel } from '@/lib/youtube-sync';

const SAFETY_MARGIN_MIN = 10;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelUuid } = await params;
    if (!channelUuid) {
      return NextResponse.json({ error: 'Channel id required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await syncOneChannel(supabase, channelUuid, {
      safetyMarginMin: SAFETY_MARGIN_MIN,
    });

    if (!result.ok && result.error === 'YouTube API key not configured') {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    if (!result.ok && result.error === 'Channel not found') {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Sync failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, new_videos: result.new_videos });
  } catch (err) {
    console.error('[channels/sync] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
