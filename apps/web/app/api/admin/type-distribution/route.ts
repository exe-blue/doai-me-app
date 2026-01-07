import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 기간 필터 계산
function getDateFilter(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

// 유효한 period 값 목록
const VALID_PERIODS = ['1h', '24h', '7d', '30d', 'all'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    
    // period 유효성 검사
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json(
        { error: `Invalid period value. Must be one of: ${VALID_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }
    
    const dateFilter = getDateFilter(period);
    
    // period가 'all'일 때 dateFilter는 null (정상 동작)
    // 다른 유효한 period 값은 항상 non-null Date를 반환하므로 별도 체크 불필요

    // 웜홀 타입별 집계
    let query = supabase
      .from('wormhole_events')
      .select('wormhole_type');

    if (dateFilter) {
      query = query.gte('detected_at', dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // 타입별 카운트
    const counts = {
      alpha: 0,  // α
      beta: 0,   // β
      gamma: 0,  // γ
    };

    data?.forEach((item: { wormhole_type: string }) => {
      const type = item.wormhole_type;
      // DB에서 α, β, γ 또는 alpha, beta, gamma로 저장될 수 있음
      if (type === 'α' || type === 'alpha') counts.alpha++;
      else if (type === 'β' || type === 'beta') counts.beta++;
      else if (type === 'γ' || type === 'gamma') counts.gamma++;
    });

    const total = counts.alpha + counts.beta + counts.gamma;

    const distribution = {
      alpha: {
        count: counts.alpha,
        percentage: total > 0 ? (counts.alpha / total) * 100 : 0,
      },
      beta: {
        count: counts.beta,
        percentage: total > 0 ? (counts.beta / total) * 100 : 0,
      },
      gamma: {
        count: counts.gamma,
        percentage: total > 0 ? (counts.gamma / total) * 100 : 0,
      },
      total,
    };

    return NextResponse.json(distribution);
  } catch (error) {
    console.error('Type Distribution API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch type distribution' },
      { status: 500 }
    );
  }
}


