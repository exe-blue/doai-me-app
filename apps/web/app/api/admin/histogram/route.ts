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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';
    
    const dateFilter = getDateFilter(period);

    // 웜홀 이벤트 조회
    let query = supabase
      .from('wormhole_events')
      .select('resonance_score');

    if (dateFilter) {
      query = query.gte('detected_at', dateFilter.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    // 빈(bin) 생성 (0.75 ~ 1.00, 0.025 간격)
    const binSize = 0.025;
    const bins: Array<{ range: [number, number]; count: number }> = [];
    
    for (let start = 0.75; start < 1.0; start += binSize) {
      const end = Math.min(start + binSize, 1.0);
      bins.push({
        range: [Math.round(start * 1000) / 1000, Math.round(end * 1000) / 1000],
        count: 0,
      });
    }

    // 데이터 분류
    const scores = data?.map(d => d.resonance_score) || [];
    
    scores.forEach(score => {
      const binIndex = Math.min(
        Math.floor((score - 0.75) / binSize),
        bins.length - 1
      );
      if (binIndex >= 0 && binIndex < bins.length) {
        bins[binIndex].count++;
      }
    });

    // 통계 계산
    const total = scores.length;
    const sortedScores = [...scores].sort((a, b) => a - b);
    const mean = total > 0 
      ? scores.reduce((a, b) => a + b, 0) / total 
      : 0;
    
    // 중앙값 계산 (짝수 길이 배열 처리)
    let median = 0;
    if (total > 0) {
      const mid = Math.floor(total / 2);
      if (total % 2 === 0) {
        // 짝수: 두 중앙값의 평균
        median = (sortedScores[mid - 1] + sortedScores[mid]) / 2;
      } else {
        // 홀수: 중앙 요소
        median = sortedScores[mid];
      }
    }

    // 현재 임계값 조회 (설정 테이블에서, 없으면 기본값)
    const { data: configData } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'resonance_threshold')
      .single();

    const currentThreshold = configData?.value 
      ? parseFloat(configData.value) 
      : 0.92;

    const aboveThreshold = scores.filter(s => s >= currentThreshold).length;

    return NextResponse.json({
      bins,
      currentThreshold,
      stats: {
        total,
        aboveThreshold,
        belowThreshold: total - aboveThreshold,
        mean: Math.round(mean * 1000) / 1000,
        median: Math.round(median * 1000) / 1000,
      },
    });
  } catch (error) {
    console.error('Histogram API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch histogram data' },
      { status: 500 }
    );
  }
}


