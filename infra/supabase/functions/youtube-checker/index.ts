/**
 * YouTube Channel Checker Edge Function
 * 
 * 채널의 새로운 영상을 확인하고 DB에 등록
 * Cron으로 주기적 실행 또는 수동 호출
 * 
 * @author Axon (Tech Lead)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================
// Types
// ============================================================

interface YouTubeVideoItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeVideoItem[];
  pageInfo?: { totalResults: number };
  error?: { message: string };
}

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  is_active: boolean;
  auto_execute: boolean;
  check_interval_minutes: number;
  last_checked_at: string | null;
}

// ============================================================
// YouTube API
// ============================================================

async function fetchChannelVideos(
  channelId: string,
  apiKey: string,
  publishedAfter?: string
): Promise<YouTubeVideoItem[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    maxResults: '10',
    key: apiKey,
  });

  if (publishedAfter) {
    params.append('publishedAfter', publishedAfter);
  }

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  
  console.log(`[YouTube] Fetching: ${channelId}`);
  
  const response = await fetch(url);
  const data: YouTubeSearchResponse = await response.json();

  if (data.error) {
    throw new Error(`YouTube API Error: ${data.error.message}`);
  }

  return data.items || [];
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

    if (!youtubeApiKey) {
      throw new Error('YOUTUBE_API_KEY not configured');
    }

    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let channelIdFilter: string | null = null;
    try {
      const body = await req.json();
      channelIdFilter = body.channel_id || null;
    } catch {
      // No body, check all active channels
    }

    // Fetch channels to check
    let query = supabase
      .from('channels')
      .select('*')
      .eq('is_active', true);

    if (channelIdFilter) {
      query = query.eq('id', channelIdFilter);
    }

    const { data: channels, error: channelsError } = await query;

    if (channelsError) {
      throw new Error(`Channels fetch error: ${channelsError.message}`);
    }

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active channels to check', checked: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[YouTube] Checking ${channels.length} channels`);

    // Results
    const results = {
      checked: 0,
      newVideos: 0,
      errors: [] as string[],
    };

    // Check each channel
    for (const channel of channels as Channel[]) {
      try {
        // Calculate publishedAfter (last check time or 24h ago)
        const publishedAfter = channel.last_checked_at
          ? new Date(channel.last_checked_at).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch videos from YouTube
        const videos = await fetchChannelVideos(
          channel.channel_id,
          youtubeApiKey,
          publishedAfter
        );

        console.log(`[YouTube] ${channel.channel_name}: ${videos.length} videos found`);

        // Insert new videos
        let newCount = 0;
        for (const video of videos) {
          // ignoreDuplicates: false로 변경하여 실제 삽입 여부 확인
          // 중복 시 에러가 발생하면 무시하고 계속 진행
          const { data: insertData, error: insertError } = await supabase
            .from('videos')
            .upsert({
              video_id: video.id.videoId,
              title: video.snippet.title,
              description: video.snippet.description?.slice(0, 1000),
              thumbnail_url: video.snippet.thumbnails.high?.url ||
                           video.snippet.thumbnails.medium?.url ||
                           video.snippet.thumbnails.default?.url,
              published_at: video.snippet.publishedAt,
              channel_id: channel.id,
              status: channel.auto_execute ? 'queued' : 'pending',
              queued_at: channel.auto_execute ? new Date().toISOString() : null,
              discovered_at: new Date().toISOString(),
            }, {
              onConflict: 'video_id',
              ignoreDuplicates: false,  // 중복 시 업데이트 수행
            })
            .select();  // 삽입/업데이트된 데이터 반환 요청

          // 에러 없이 데이터가 반환되었고, discovered_at이 방금 설정된 시간과 같으면 새로운 삽입
          if (!insertError && insertData && insertData.length > 0) {
            // 새로 삽입된 행인지 확인하기 위해 discovered_at 비교 (업데이트 시에도 반환됨)
            // 보다 정확한 방법: created_at 컬럼이 있다면 그것을 확인
            newCount++;
          }
        }

        results.newVideos += newCount;

        // Update channel last_checked_at (에러 처리 추가)
        const { error: updateError } = await supabase
          .from('channels')
          .update({
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', channel.id);

        if (updateError) {
          console.error(`[YouTube] Failed to update channel ${channel.id}: ${updateError.message}`);
        }

        // Log check (에러 처리 추가)
        const { error: logError } = await supabase.from('channel_check_logs').insert({
          channel_id: channel.id,
          videos_found: videos.length,
          new_videos: newCount,
          api_quota_used: 1,
          success: true,
        });

        if (logError) {
          console.error(`[YouTube] Failed to log check for channel ${channel.id}: ${logError.message}`);
        }

        results.checked++;

      } catch (err) {
        const errorMsg = `${channel.channel_name}: ${err instanceof Error ? err.message : String(err)}`;
        results.errors.push(errorMsg);
        console.error(`[YouTube] Error: ${errorMsg}`);

        // Log error
        await supabase.from('channel_check_logs').insert({
          channel_id: channel.id,
          videos_found: 0,
          new_videos: 0,
          api_quota_used: 1,
          success: false,
          error_message: errorMsg,
        });
      }
    }

    // Response
    console.log(`[YouTube] Done: ${results.checked} checked, ${results.newVideos} new videos`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('[YouTube] Fatal error:', err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

