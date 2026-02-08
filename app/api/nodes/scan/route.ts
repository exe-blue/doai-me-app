/**
 * POST /api/nodes/scan — create scan job (ip_range, ports). Background scan stub for MVP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip_range = body.ip_range as string | undefined;
    const ports = body.ports as number[] | undefined;

    if (!ip_range || typeof ip_range !== 'string' || ip_range.trim() === '') {
      return NextResponse.json({ error: 'ip_range required' }, { status: 400 });
    }

    const portsArray = Array.isArray(ports) ? ports : [5555];
    const portsText = portsArray.map(String).filter(Boolean);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        ip_range: ip_range.trim(),
        ports: portsText.length ? portsText : ['5555'],
        status: 'pending',
      })
      .select('id, ip_range, ports, status, created_at')
      .single();

    if (error || !job) {
      console.error('[nodes/scan] Insert failed', error);
      return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json(
      {
        scan_job_id: job.id,
        status: job.status,
        ip_range: job.ip_range,
        ports: job.ports,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[nodes/scan] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
