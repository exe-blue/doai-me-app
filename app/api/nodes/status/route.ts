/**
 * DoAi.Me MVP Orchestration v1 — Node reports per-device task status
 * Shared secret auth; every log includes run_id/node_id/device_serial
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const header = req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

export async function POST(req: NextRequest) {
  if (!verifyNodeAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { run_id, node_id, device_serial, status, device_task_id } = body;

  if (!run_id || !node_id || !device_serial || !status) {
    return NextResponse.json({ error: 'run_id, node_id, device_serial, status required' }, { status: 400 });
  }

  console.log(`[run_id=${run_id} node_id=${node_id} device_serial=${device_serial}] Status: ${status}`);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (device_task_id) {
    const { error } = await supabase
      .from('device_tasks')
      .update({
        status,
        node_id,
        ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
        ...(status === 'completed' || status === 'failed' ? { finished_at: new Date().toISOString() } : {}),
      })
      .eq('id', device_task_id);

    if (error) {
      console.error(`[run_id=${run_id} node_id=${node_id} device_serial=${device_serial}] Update failed`, error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
