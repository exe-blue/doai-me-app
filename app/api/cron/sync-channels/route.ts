/**
 * GET /api/cron/sync-channels — 3분마다 모든 채널 동기화 (Vercel Cron).
 * Authorization: Bearer CRON_SECRET 또는 x-vercel-cron header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncOneChannel } from '@/lib/youtube-sync';

const SAFETY_MARGIN_MIN = 10;

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: channels, error: listErr } = await supabase
      .from('channels')
      .select('id')
      .eq('provider', 'youtube');

    if (listErr || !channels?.length) {
      return NextResponse.json({ synced: 0, total_new: 0 });
    }

    let totalNew = 0;
    for (const ch of channels) {
      const res = await syncOneChannel(supabase, (ch as { id: string }).id, {
        safetyMarginMin: SAFETY_MARGIN_MIN,
      });
      if (res.ok) totalNew += res.new_videos;
    }

    return NextResponse.json({
      synced: channels.length,
      total_new: totalNew,
    });
  } catch (err) {
    console.error('[cron/sync-channels] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
