/**
 * GET /api/content/status?window=24h&status=new|done&channel_id=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const windowHours = Math.min(168, Math.max(1, parseInt(searchParams.get('window') ?? '24', 10) || 24));
    const statusFilter = searchParams.get('status') ?? undefined; // new | done
    const channelId = searchParams.get('channel_id') ?? undefined;

    const end = new Date();
    const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('contents')
      .select(`
        id,
        content_id,
        title,
        published_at,
        thumbnail_url,
        status,
        run_id,
        channel_id,
        channels (channel_id, title),
        runs (status)
      `)
      .gte('published_at', startISO)
      .lte('published_at', endISO)
      .order('published_at', { ascending: false });

    if (statusFilter === 'new' || statusFilter === 'done') {
      query = query.eq('status', statusFilter);
    }
    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('[content/status] Query failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (rows ?? []).map((r: Record<string, unknown>) => {
      const ch = (r.channels as Record<string, unknown> | null) ?? {};
      const run = (r.runs as { status?: string } | null) ?? {};
      const derivedStatus =
        r.run_id && (run.status === 'completed' || run.status === 'completed_with_errors')
          ? 'done'
          : (r.status as string) ?? 'new';
      return {
        content_id: r.content_id,
        title: r.title,
        channel: {
          channel_id: ch.channel_id ?? null,
          title: ch.title ?? null,
        },
        published_at: r.published_at,
        thumbnail_url: r.thumbnail_url,
        status: derivedStatus,
        run_id: r.run_id ?? null,
      };
    });

    return NextResponse.json({
      window: { hours: windowHours, start: startISO, end: endISO },
      filters: { status: statusFilter ?? null, channel_id: channelId ?? null },
      items,
    });
  } catch (err) {
    console.error('[content/status] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
