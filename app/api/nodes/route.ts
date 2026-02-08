/**
 * DoAi.Me MVP — GET node status (dashboard); from node_heartbeats
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from('node_heartbeats')
    .select('node_id, updated_at, payload')
    .order('node_id');

  if (error) {
    console.error('[nodes] List failed', error);
    return NextResponse.json({ error: 'List failed' }, { status: 500 });
  }

  const nodes = (rows ?? []).map((r) => {
    const p = (r.payload as Record<string, unknown>) ?? {};
    return {
      node_id: r.node_id,
      status: p.vendor_ws_ok === false ? 'degraded' : 'online',
      last_heartbeat_at: new Date(r.updated_at).getTime(),
      connected_devices_count: (p.connected_devices_count as number) ?? 0,
      running_devices_count: (p.running_devices_count as number) ?? 0,
      queue_devices_count: (p.queue_devices_count as number) ?? 0,
      vendor_ws_ok: (p.vendor_ws_ok as boolean) ?? false,
    };
  });

  return NextResponse.json({ nodes });
}
