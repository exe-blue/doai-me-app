/**
 * DoAi.Me MVP — GET run summary (nodes aggregation, totals)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: run, error: runErr } = await supabase
    .from('runs')
    .select(`
      id,
      status,
      trigger,
      scope,
      youtube_video_id,
      created_at,
      started_at,
      finished_at,
      workflow_id,
      workflows ( workflow_id, name )
    `)
    .eq('id', runId)
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const workflow = Array.isArray(run.workflows) ? run.workflows[0] : run.workflows;
  const workflow_id = workflow?.workflow_id ?? null;

  const { data: tasks } = await supabase
    .from('device_tasks')
    .select('node_id, status, failure_reason')
    .eq('run_id', runId);

  const byNode = new Map<
    string,
    { succeeded: number; failed: number; timeout: number }
  >();
  let succeeded = 0;
  let failed = 0;
  let timeout = 0;
  for (const t of tasks ?? []) {
    const nid = t.node_id ?? 'unknown';
    if (!byNode.has(nid)) byNode.set(nid, { succeeded: 0, failed: 0, timeout: 0 });
    const agg = byNode.get(nid)!;
    if (t.status === 'completed') {
      agg.succeeded++;
      succeeded++;
    } else if (t.failure_reason === 'timeout') {
      agg.timeout++;
      timeout++;
    } else {
      agg.failed++;
      failed++;
    }
  }

  const nodes = Array.from(byNode.entries()).map(([node_id, summary]) => ({
    node_id,
    status: tasks?.some((t) => t.node_id === node_id && t.status === 'running')
      ? 'running'
      : 'completed',
    summary,
  }));

  return NextResponse.json({
    run_id: run.id,
    trigger: run.trigger ?? 'manual',
    scope: run.scope ?? 'ALL',
    workflow_id,
    status: run.status,
    created_at: run.created_at ? new Date(run.created_at).getTime() : null,
    started_at: run.started_at ? new Date(run.started_at).getTime() : null,
    ended_at: run.finished_at ? new Date(run.finished_at).getTime() : null,
    nodes,
    totals: { succeeded, failed, timeout },
  });
}
