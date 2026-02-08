/**
 * GET /api/nodes/scan/:scanJobId — 스캔 상태 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanJobId: string }> }
) {
  const { scanJobId } = await params;
  if (!scanJobId) {
    return NextResponse.json({ error: 'scanJobId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: job, error } = await supabase
    .from('scan_jobs')
    .select('id, status, ip_range, ports, started_at, finished_at, log_snippet')
    .eq('id', scanJobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Scan job not found' }, { status: 404 });
  }

  const j = job as { id: string; status: string; ip_range: string; ports: string[]; started_at: string | null; finished_at: string | null };
  const { data: results } = await supabase.from('scan_results').select('id').eq('scan_job_id', scanJobId);
  const found_count = results?.length ?? 0;

  return NextResponse.json({
    scan_job_id: j.id,
    status: j.status,
    found_count,
    last_error_message: null,
  });
}
