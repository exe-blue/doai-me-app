/**
 * GET /api/channels?sort=alpha|recent
 * POST /api/channels — body: { provider: 'youtube', channel_url_or_id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_API_KEY;

function extractChannelId(input: string): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  if (/^UC[\w-]{22}$/.test(s)) return s;
  const m = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/i) || s.match(/\/channel\/(UC[\w-]{22})/i);
  if (m) return m[1];
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const sort = searchParams.get('sort') === 'recent' ? 'recent' : 'alpha';

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const query = supabase
      .from('channels')
      .select('id, channel_id, title, thumbnail_url, last_sync_at, created_at')
      .order(sort === 'recent' ? 'last_sync_at' : 'title', {
        ascending: sort === 'alpha',
        nullsFirst: false,
      });

    const { data: rows, error } = await query;

    if (error) {
      console.error('[channels] List failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const channelIds = (rows ?? []).map((r) => (r as { id: string }).id);
    const start24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const newCounts: Record<string, number> = {};
    const latestPublished: Record<string, string> = {};
    if (channelIds.length > 0) {
      const { data: agg } = await supabase
        .from('contents')
        .select('channel_id, published_at')
        .in('channel_id', channelIds)
        .order('published_at', { ascending: false });
      const byCh = new Map<string, { count: number; latest: string }>();
      for (const c of agg ?? []) {
        const chId = (c as { channel_id: string }).channel_id;
        const pub = (c as { published_at: string }).published_at ?? '';
        if (!byCh.has(chId)) byCh.set(chId, { count: 0, latest: pub });
        const cur = byCh.get(chId)!;
        if (pub >= start24h) cur.count++;
        if (pub && (!cur.latest || pub > cur.latest)) cur.latest = pub;
      }
      byCh.forEach((v, k) => {
        newCounts[k] = v.count;
        latestPublished[k] = v.latest;
      });
    }

    const items = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      channel_id: r.channel_id,
      title: r.title,
      thumbnail_url: r.thumbnail_url,
      last_sync_at: r.last_sync_at,
      new_24h: newCounts[r.id as string] ?? 0,
      latest_published_at: latestPublished[r.id as string] ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[channels] GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider = (body.provider as string) ?? 'youtube';
    const channelUrlOrId = (body.channel_url_or_id as string) ?? '';

    if (provider !== 'youtube') {
      return NextResponse.json({ error: 'Only youtube provider supported' }, { status: 400 });
    }

    const channelId = extractChannelId(channelUrlOrId);
    if (!channelId) {
      return NextResponse.json({ error: 'Invalid channel_url_or_id' }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 503 });
    }

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`
    );
    if (!res.ok) {
      const t = await res.text();
      console.error('[channels] YouTube channels.list failed', res.status, t);
      return NextResponse.json({ error: 'YouTube API error' }, { status: 502 });
    }
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const snippet = item.snippet ?? {};
    const thumb = snippet.thumbnails?.medium ?? snippet.thumbnails?.default;
    const title = snippet.title ?? '';
    const thumbnail_url = thumb?.url ?? null;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: inserted, error } = await supabase
      .from('channels')
      .upsert(
        {
          provider: 'youtube',
          channel_id: channelId,
          title,
          thumbnail_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider,channel_id' }
      )
      .select('id, channel_id, title, thumbnail_url')
      .single();

    if (error || !inserted) {
      console.error('[channels] Upsert failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: (inserted as { id: string }).id,
      channel_id: (inserted as { channel_id: string }).channel_id,
      title: (inserted as { title: string }).title,
      thumbnail_url: (inserted as { thumbnail_url: string | null }).thumbnail_url,
    });
  } catch (err) {
    console.error('[channels] POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
