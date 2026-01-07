import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// 연결 타임아웃 상수 (30초)
const DEVICE_CONNECTION_THRESHOLD_MS = 30 * 1000;

// 환경변수
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 클라이언트 생성 (요청 시점에 검증)
function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 디바이스 데이터 타입 정의
interface DeviceWithNode {
  device_id: string;
  node_id: string;
  laixi_id: string | null;
  slot_number: number | null;
  model: string | null;
  status: string;
  last_seen: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  nodes: { name: string; status_v2?: string } | null;
}

// Admin 인증 확인 헬퍼
async function checkAdminAuth(): Promise<{ authorized: boolean; userId?: string }> {
  // MVP: 인증 체크 건너뛰기 (나중에 @supabase/ssr로 마이그레이션)
  // TODO: @supabase/ssr 사용하여 proper auth 구현
  return {
    authorized: true,
    userId: 'mvp-user',
  };
}

export async function GET(request: NextRequest) {
  try {
    // Supabase 클라이언트 생성 (요청 시점 검증)
    const supabase = getSupabaseClient();

    // 인증 확인
    const auth = await checkAdminAuth();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const runnerId = searchParams.get('runner_id');
    const status = searchParams.get('status');

    // v_device_grid 뷰 사용
    let query = supabase
      .from('v_device_grid')
      .select('*')
      .order('runner_id', { ascending: true })
      .order('slot_number', { ascending: true });

    if (runnerId) {
      query = query.eq('runner_id', runnerId);
    }

    if (status) {
      query = query.eq('grid_status', status);
    }

    const { data, error } = await query;

    if (error) {
      // 뷰가 없으면 devices 테이블 직접 조회
      if (error.code === '42P01') {
        const now = Date.now();
        
        // status 파라미터를 devices.status로 매핑
        const statusMapping: Record<string, string[]> = {
          active: ['online', 'busy'],
          error: ['error'],
          offline: ['offline'],
        };

        let fallbackQuery = supabase
          .from('devices')
          .select(`
            device_id,
            node_id,
            laixi_id,
            slot_number,
            model,
            status,
            last_seen,
            last_error_code,
            last_error_message,
            nodes(name, status_v2)
          `)
          .order('node_id')
          .order('slot_number');

        // runnerId 필터 적용
        if (runnerId) {
          fallbackQuery = fallbackQuery.eq('node_id', runnerId);
        }

        // status 필터 적용 (매핑된 값 사용)
        if (status && statusMapping[status]) {
          fallbackQuery = fallbackQuery.in('status', statusMapping[status]);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) throw fallbackError;

        // 데이터 변환 (연결 상태는 시간 기반으로 계산, 타입 안전하게 처리)
        const transformedData = (fallbackData as unknown as DeviceWithNode[] | null)?.map((d) => {
          let connectionStatus: 'connected' | 'disconnected' = 'disconnected';
          
          if (d.last_seen) {
            const lastSeenTs = new Date(d.last_seen).getTime();
            if (!isNaN(lastSeenTs) && (now - lastSeenTs) < DEVICE_CONNECTION_THRESHOLD_MS) {
              connectionStatus = 'connected';
            }
          }

          return {
            device_id: d.device_id,
            runner_id: d.node_id,
            device_serial: d.laixi_id,
            slot_number: d.slot_number,
            model: d.model,
            connection_status: connectionStatus,
            work_status: 'idle',
            grid_status: d.status === 'online' ? 'active' : 
                         d.status === 'error' ? 'error' : 
                         d.status === 'busy' ? 'active' : 'offline',
            last_seen: d.last_seen,
            last_command: null,
            last_error_code: d.last_error_code,
            last_error_message: d.last_error_message,
            runner_name: d.nodes?.name ?? d.node_id,
          };
        });

        return NextResponse.json(transformedData || []);
      }
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Devices API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}


