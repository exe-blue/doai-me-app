/**
 * DoAi.Me MVP Orchestration v1 — Nodes receive start-run / report status
 * Shared secret auth for server↔node
 */

import { NextRequest, NextResponse } from 'next/server';

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
  const { run_id, node_id, device_serial, status, action } = body;

  if (action === 'start-run') {
    // Node received broadcast; node will poll /api/nodes/tasks?run_id=xxx to get its device assignments
    console.log(`[run_id=${run_id} node_id=${node_id}] Start-run received`);
    return NextResponse.json({ ok: true });
  }

  if (action === 'report-status') {
    if (!run_id || !node_id || !device_serial || !status) {
      return NextResponse.json({ error: 'run_id, node_id, device_serial, status required' }, { status: 400 });
    }
    console.log(`[run_id=${run_id} node_id=${node_id} device_serial=${device_serial}] Status: ${status}`);
    // TODO: Update device_tasks in Supabase
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
