/**
 * History API - 히스토리 조회 엔드포인트
 * 
 * GET /api/admin/history - 히스토리 조회
 *   ?type=summary - 요약 (대시보드용)
 *   ?type=commands - 명령 내역
 *   ?type=watches - 시청 내역
 *   ?type=workloads - 워크로드 내역
 *   &limit=100 - 최대 개수
 *   &device_id=xxx - 디바이스 필터
 *   &workload_id=xxx - 워크로드 필터
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// GET - 히스토리 조회
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'summary';
    const limit = parseInt(searchParams.get('limit') || '10');
    const deviceId = searchParams.get('device_id');
    const workloadId = searchParams.get('workload_id');

    switch (type) {
      case 'summary':
        return await getSummary(limit);
      
      case 'commands':
        return await getCommandHistory(limit, deviceId, workloadId);
      
      case 'watches':
        return await getWatchHistory(limit, deviceId);
      
      case 'workloads':
        return await getWorkloadHistory(limit, workloadId);
      
      default:
        return NextResponse.json({
          error: 'Invalid type parameter'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[History API] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ============================================
// 요약 조회 (대시보드용)
// ============================================

async function getSummary(limit: number) {
  // 최근 명령 내역
  const { data: recentCommands, error: cmdError } = await supabase
    .from('command_history')
    .select('id, device_hierarchy_id, command_type, status, duration_ms, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cmdError) {
    console.error('Command history error:', cmdError);
  }

  // 최근 시청 완료 (results 테이블에서 집계)
  const { data: recentWatches, error: watchError } = await supabase
    .from('results')
    .select(`
      id,
      video_id,
      watch_time,
      liked,
      error_message,
      created_at,
      videos (title)
    `)
    .order('created_at', { ascending: false })
    .limit(limit * 5);  // 집계를 위해 더 많이 가져옴

  if (watchError) {
    console.error('Watch history error:', watchError);
  }

  // 시청 결과 집계 (영상별)
  const watchesByVideo = new Map<string, {
    video_id: string;
    video_title: string;
    device_count: number;
    success_count: number;
    failed_count: number;
    total_watch_time: number;
    completed_at: string;
  }>();

  if (recentWatches) {
    for (const watch of recentWatches) {
      const videoId = watch.video_id;
      const existing = watchesByVideo.get(videoId);
      
      if (existing) {
        existing.device_count++;
        existing.success_count += watch.error_message ? 0 : 1;
        existing.failed_count += watch.error_message ? 1 : 0;
        existing.total_watch_time += watch.watch_time || 0;
      } else {
        watchesByVideo.set(videoId, {
          video_id: videoId,
          video_title: (watch.videos as { title: string } | null)?.title || 'Unknown',
          device_count: 1,
          success_count: watch.error_message ? 0 : 1,
          failed_count: watch.error_message ? 1 : 0,
          total_watch_time: watch.watch_time || 0,
          completed_at: watch.created_at
        });
      }
    }
  }

  // 활성 워크로드
  const { data: activeWorkloads, error: wlError } = await supabase
    .from('workloads')
    .select('id, name, status, video_ids, current_video_index, total_tasks, completed_tasks, failed_tasks')
    .in('status', ['listing', 'executing', 'recording', 'waiting'])
    .order('started_at', { ascending: false })
    .limit(5);

  if (wlError) {
    console.error('Workload error:', wlError);
  }

  // 응답 구성
  const formattedWorkloads = (activeWorkloads || []).map(wl => ({
    id: wl.id,
    name: wl.name || '이름 없음',
    status: wl.status,
    video_count: Array.isArray(wl.video_ids) ? wl.video_ids.length : 0,
    current_video_index: wl.current_video_index || 0,
    progress_percent: wl.total_tasks > 0 
      ? (wl.completed_tasks / wl.total_tasks) * 100 
      : 0,
    completed_tasks: wl.completed_tasks || 0,
    total_tasks: wl.total_tasks || 0
  }));

  return NextResponse.json({
    recent_commands: recentCommands || [],
    recent_watches: Array.from(watchesByVideo.values()).slice(0, limit),
    active_workloads: formattedWorkloads
  });
}

// ============================================
// 명령 내역 조회
// ============================================

async function getCommandHistory(
  limit: number,
  deviceId: string | null,
  workloadId: string | null
) {
  let query = supabase
    .from('command_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  if (workloadId) {
    query = query.eq('workload_id', workloadId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 통계 계산
  const stats = {
    total: data?.length || 0,
    success: data?.filter(d => d.status === 'success').length || 0,
    failed: data?.filter(d => d.status === 'failed').length || 0,
    timeout: data?.filter(d => d.status === 'timeout').length || 0
  };

  return NextResponse.json({
    commands: data || [],
    stats
  });
}

// ============================================
// 시청 내역 조회
// ============================================

async function getWatchHistory(
  limit: number,
  deviceId: string | null
) {
  let query = supabase
    .from('results')
    .select(`
      id,
      video_id,
      device_id,
      watch_time,
      total_duration,
      watch_percent,
      liked,
      commented,
      comment_text,
      error_message,
      created_at,
      videos (id, title, url, thumbnail_url),
      devices (id, serial_number, hierarchy_id, model)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 통계 계산
  const stats = {
    total: data?.length || 0,
    total_watch_time: data?.reduce((sum, d) => sum + (d.watch_time || 0), 0) || 0,
    avg_watch_percent: data?.length 
      ? data.reduce((sum, d) => sum + (d.watch_percent || 0), 0) / data.length 
      : 0,
    likes: data?.filter(d => d.liked).length || 0,
    comments: data?.filter(d => d.commented).length || 0
  };

  return NextResponse.json({
    results: data || [],
    stats
  });
}

// ============================================
// 워크로드 내역 조회
// ============================================

async function getWorkloadHistory(
  limit: number,
  workloadId: string | null
) {
  if (workloadId) {
    // 특정 워크로드 상세
    const { data: workload, error: wlError } = await supabase
      .from('workloads')
      .select('*')
      .eq('id', workloadId)
      .single();

    if (wlError) {
      return NextResponse.json({ error: wlError.message }, { status: 404 });
    }

    // 워크로드 로그
    const { data: logs, error: logError } = await supabase
      .from('workload_logs')
      .select('*')
      .eq('workload_id', workloadId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 관련 명령 내역
    const { data: commands, error: cmdError } = await supabase
      .from('command_history')
      .select('*')
      .eq('workload_id', workloadId)
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      workload,
      logs: logs || [],
      commands: commands || []
    });
  }

  // 워크로드 목록
  const { data, error } = await supabase
    .from('workloads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 상태별 통계
  const stats = {
    total: data?.length || 0,
    pending: data?.filter(d => d.status === 'pending').length || 0,
    active: data?.filter(d => ['listing', 'executing', 'recording', 'waiting'].includes(d.status)).length || 0,
    completed: data?.filter(d => d.status === 'completed').length || 0,
    cancelled: data?.filter(d => d.status === 'cancelled').length || 0,
    error: data?.filter(d => d.status === 'error').length || 0
  };

  return NextResponse.json({
    workloads: data || [],
    stats
  });
}
