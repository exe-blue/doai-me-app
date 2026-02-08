/**
 * POST /api/runs/:runId/stop — request run stop (Node polls and stops)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: run, error: fetchErr } = await supabase
      .from('runs')
      .select('id, status')
      .eq('id', runId)
      .single();

    if (fetchErr || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.status !== 'queued' && run.status !== 'running') {
      return NextResponse.json(
        { ok: true, run_id: runId, status: run.status, message: 'Run already finished or stopped' }
      );
    }

    const { error: updateErr } = await supabase
      .from('runs')
      .update({ stop_requested_at: new Date().toISOString() })
      .eq('id', runId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      run_id: runId,
      status: run.status,
    });
  } catch (err) {
    console.error('[runs/:runId/stop] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
