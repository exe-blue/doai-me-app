/**
 * YouTube Channel API
 *
 * 채널 정보 조회 및 최신 영상 목록
 *
 * GET /api/youtube/channel?channelId=CHANNEL_ID
 * GET /api/youtube/channel?handle=@CHANNEL_HANDLE
 * GET /api/youtube/channel?url=CHANNEL_URL
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// 채널 URL/핸들에서 채널 ID 추출
function extractChannelInfo(input: string): { type: 'id' | 'handle' | 'username', value: string } | null {
  // @handle 형식
  if (input.startsWith('@')) {
    return { type: 'handle', value: input.slice(1) };
  }
  
  // 채널 URL 패턴들
  const patterns = [
    { regex: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, type: 'id' as const },
    { regex: /youtube\.com\/@([a-zA-Z0-9_-]+)/, type: 'handle' as const },
    { regex: /youtube\.com\/c\/([a-zA-Z0-9_-]+)/, type: 'username' as const },
    { regex: /youtube\.com\/user\/([a-zA-Z0-9_-]+)/, type: 'username' as const },
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern.regex);
    if (match) {
      return { type: pattern.type, value: match[1] };
    }
  }
  
  // 직접 채널 ID인 경우
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) {
    return { type: 'id', value: input };
  }
  
  return null;
}

// 핸들/유저네임으로 채널 ID 조회
async function resolveChannelId(type: 'handle' | 'username', value: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API 키가 설정되지 않았습니다');
  }
  
  let apiUrl: string;
  
  if (type === 'handle') {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${value}&key=${YOUTUBE_API_KEY}`;
  } else {
    apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${value}&key=${YOUTUBE_API_KEY}`;
  }
  
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  if (data.items && data.items.length > 0) {
    return data.items[0].id;
  }
  
  return null;
}

// 채널 정보 조회
async function fetchChannelInfo(channelId: string) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API 키가 설정되지 않았습니다');
  }
  
  const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('채널을 찾을 수 없습니다');
  }
  
  const channel = data.items[0];
  const snippet = channel.snippet;
  const statistics = channel.statistics;
  const contentDetails = channel.contentDetails;
  
  return {
    channelId,
    title: snippet.title,
    description: snippet.description,
    customUrl: snippet.customUrl,
    thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(statistics.subscriberCount || '0'),
    videoCount: parseInt(statistics.videoCount || '0'),
    viewCount: parseInt(statistics.viewCount || '0'),
    uploadsPlaylistId: contentDetails?.relatedPlaylists?.uploads,
    publishedAt: snippet.publishedAt,
  };
}

// 채널의 최신 영상 목록 조회
async function fetchChannelVideos(uploadsPlaylistId: string, maxResults: number = 10) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API 키가 설정되지 않았습니다');
  }
  
  const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
  
  const response = await fetch(apiUrl);
  const data = await response.json();
  
  if (!data.items) {
    return [];
  }
  
  return data.items.map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown>;
    const contentDetails = item.contentDetails as Record<string, unknown>;
    const thumbnails = snippet.thumbnails as Record<string, { url: string }>;
    
    return {
      videoId: contentDetails.videoId,
      title: snippet.title,
      description: snippet.description,
      thumbnail: thumbnails?.high?.url || thumbnails?.default?.url,
      publishedAt: contentDetails.videoPublishedAt || snippet.publishedAt,
      channelId: snippet.channelId,
      channelTitle: snippet.channelTitle,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');
    const handle = searchParams.get('handle');
    const url = searchParams.get('url');
    const includeVideos = searchParams.get('includeVideos') !== 'false';
    const maxVideos = parseInt(searchParams.get('maxVideos') || '10');
    
    let resolvedChannelId: string | null = channelId;
    
    // URL 또는 핸들에서 채널 ID 추출
    if (!resolvedChannelId) {
      const input = url || handle || '';
      const extracted = extractChannelInfo(input);
      
      if (!extracted) {
        return NextResponse.json(
          { success: false, error: '유효한 채널 ID, 핸들 또는 URL이 필요합니다' },
          { status: 400 }
        );
      }
      
      if (extracted.type === 'id') {
        resolvedChannelId = extracted.value;
      } else {
        resolvedChannelId = await resolveChannelId(extracted.type, extracted.value);
        
        if (!resolvedChannelId) {
          return NextResponse.json(
            { success: false, error: '채널을 찾을 수 없습니다' },
            { status: 404 }
          );
        }
      }
    }
    
    // 채널 정보 조회
    const channelInfo = await fetchChannelInfo(resolvedChannelId);
    
    // 최신 영상 목록 조회
    let videos: Array<Record<string, unknown>> = [];
    if (includeVideos && channelInfo.uploadsPlaylistId) {
      videos = await fetchChannelVideos(channelInfo.uploadsPlaylistId, maxVideos);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        channel: channelInfo,
        videos,
      },
    });
    
  } catch (error) {
    console.error('YouTube Channel API error:', error);
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

