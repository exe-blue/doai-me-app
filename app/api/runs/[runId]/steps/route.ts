/**
 * GET /api/runs/:runId/steps — Run Monitor: step results per device
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
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

    const { data: run, error: runErr } = await supabase
      .from('runs')
      .select('id')
      .eq('id', runId)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const { data: results, error: resErr } = await supabase
      .from('run_step_results')
      .select(`
        id,
        device_task_id,
        step_id,
        sort_order,
        status,
        started_at,
        finished_at,
        log_snippet,
        artifact_id,
        error_message
      `)
      .eq('run_id', runId)
      .order('sort_order')
      .order('device_task_id');

    if (resErr) {
      return NextResponse.json({ error: resErr.message }, { status: 500 });
    }

    const { data: tasks } = await supabase
      .from('device_tasks')
      .select('id, device_serial, device_id, status')
      .eq('run_id', runId);

    const taskIdToDevice: Record<string, { device_serial: string; device_id: string | null; status: string }> = {};
    for (const t of tasks ?? []) {
      taskIdToDevice[t.id] = {
        device_serial: t.device_serial,
        device_id: t.device_id ?? null,
        status: t.status,
      };
    }

    const byStep = new Map<
      string,
      {
        step_id: string;
        sort_order: number;
        device_results: Array<{
          device_task_id: string;
          device_id: string | null;
          device_serial: string;
          status: string;
          started_at: string | null;
          finished_at: string | null;
          log_snippet: string | null;
          artifact_id: string | null;
          error_message: string | null;
        }>;
      }
    >();

    for (const r of results ?? []) {
      const key = r.step_id;
      if (!byStep.has(key)) {
        byStep.set(key, { step_id: r.step_id, sort_order: r.sort_order ?? 0, device_results: [] });
      }
      const dev = taskIdToDevice[r.device_task_id ?? ''] ?? {
        device_serial: r.device_task_id ?? '—',
        device_id: null,
        status: 'unknown',
      };
      byStep.get(key)!.device_results.push({
        device_task_id: r.device_task_id,
        device_id: dev.device_id,
        device_serial: dev.device_serial,
        status: r.status,
        started_at: r.started_at,
        finished_at: r.finished_at,
        log_snippet: r.log_snippet,
        artifact_id: r.artifact_id,
        error_message: r.error_message,
      });
    }

    const steps = Array.from(byStep.values()).sort((a, b) => a.sort_order - b.sort_order);

    return NextResponse.json({ run_id: runId, steps });
  } catch (err) {
    console.error('[runs/:runId/steps] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
