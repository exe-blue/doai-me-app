/**
 * GET /api/devices/:index — 디바이스 상세 (패널용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ index: string }> }
) {
  const indexParam = (await params).index;
  const index = indexParam ? Number(indexParam) : NaN;
  if (Number.isNaN(index) || index < 1) {
    return NextResponse.json({ error: 'index required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: dev, error } = await supabase
    .from('devices')
    .select('id, index_no, device_id, runtime_handle, node_id, last_seen_at, last_error_message')
    .eq('index_no', index)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!dev) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const d = dev as { id: string; index_no: number; device_id: string; runtime_handle: string | null; node_id: string | null; last_seen_at: string | null; last_error_message: string | null };
  const ONLINE_WINDOW_SEC = 30;
  const threshold = new Date(Date.now() - ONLINE_WINDOW_SEC * 1000).toISOString();
  const online = d.last_seen_at != null && d.last_seen_at >= threshold;

  const { data: arts } = await supabase
    .from('artifacts')
    .select('kind, public_url, created_at')
    .eq('device_id', d.device_id)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    index: d.index_no,
    online,
    device_id: d.device_id,
    runtime_handle: d.runtime_handle ?? null,
    node_id: d.node_id ?? null,
    last_seen: d.last_seen_at ?? null,
    last_error_message: d.last_error_message ?? null,
    last_artifacts: (arts ?? []).map((a) => ({
      kind: (a as { kind: string }).kind ?? 'screenshot',
      url: (a as { public_url: string }).public_url ?? '',
      created_at: (a as { created_at: string }).created_at ?? null,
    })),
  });
}
