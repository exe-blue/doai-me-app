/**
 * YouTube 채널 동기화 공통 로직.
 * publishedAfter = max(last_sync_at - safety_margin, now-24h) 로 유실 방지.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_API_KEY;

export interface SyncOptions {
  /** 유실 방지용 과거 여유 분 (기본 10) */
  safetyMarginMin?: number;
}

export interface SyncResult {
  ok: boolean;
  new_videos: number;
  error?: string;
}

export async function syncOneChannel(
  supabase: SupabaseClient,
  channelUuid: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const safetyMarginMin = options.safetyMarginMin ?? 10;

  if (!YOUTUBE_API_KEY) {
    return { ok: false, new_videos: 0, error: 'YouTube API key not configured' };
  }

  const { data: channel, error: chErr } = await supabase
    .from('channels')
    .select('id, channel_id, last_sync_at')
    .eq('id', channelUuid)
    .single();

  if (chErr || !channel) {
    return { ok: false, new_videos: 0, error: 'Channel not found' };
  }

  const ytChannelId = (channel as { channel_id: string }).channel_id;
  const lastSync = (channel as { last_sync_at: string | null }).last_sync_at;

  const now = Date.now();
  const window24h = now - 24 * 60 * 60 * 1000;
  const safetyMs = safetyMarginMin * 60 * 1000;
  const fromTime = lastSync
    ? Math.max(new Date(lastSync).getTime() - safetyMs, window24h)
    : window24h;
  const publishedAfter = new Date(fromTime).toISOString();

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('channelId', ytChannelId);
  url.searchParams.set('order', 'date');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '50');
  url.searchParams.set('publishedAfter', publishedAfter);
  url.searchParams.set('key', YOUTUBE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const t = await res.text();
    console.error('[youtube-sync] search.list failed', res.status, t);
    return { ok: false, new_videos: 0, error: 'YouTube API error' };
  }

  const data = await res.json();
  const items = data?.items ?? [];
  const isoNow = new Date().toISOString();
  let newVideos = 0;

  for (const it of items) {
    const vid = it.id?.videoId;
    if (!vid) continue;
    const sn = it.snippet ?? {};
    const thumb = sn.thumbnails?.medium ?? sn.thumbnails?.default;
    const { data: existing } = await supabase
      .from('contents')
      .select('id')
      .eq('provider', 'youtube')
      .eq('content_id', vid)
      .maybeSingle();
    if (existing) continue;
    newVideos++;
    await supabase.from('contents').insert({
      provider: 'youtube',
      content_id: vid,
      channel_id: (channel as { id: string }).id,
      title: sn.title ?? null,
      published_at: sn.publishedAt ?? null,
      thumbnail_url: thumb?.url ?? null,
      status: 'new',
      last_seen_at: isoNow,
    });
  }

  await supabase
    .from('channels')
    .update({ last_sync_at: isoNow, updated_at: isoNow })
    .eq('id', channelUuid);

  return { ok: true, new_videos: newVideos };
}
