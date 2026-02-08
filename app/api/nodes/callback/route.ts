/**
 * DoAi.Me MVP — Node callback (single endpoint); event_id idempotency
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = token ?? req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

export async function POST(req: NextRequest) {
  if (!verifyNodeAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let envelope: { event_id: string; type: string; payload: Record<string, unknown> };
  try {
    envelope = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event_id, type, payload } = envelope;
  if (!event_id || !type || !payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'event_id, type, payload required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: insertEventErr } = await supabase
    .from('callback_events')
    .insert({ event_id });

  if (insertEventErr) {
    if (insertEventErr.code === '23505') {
      return NextResponse.json({ ok: true });
    }
    console.error('[callback] event insert failed', insertEventErr);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const p = payload as Record<string, unknown>;
  const run_id = p.run_id as string | undefined;
  const node_id = p.node_id as string | undefined;

  const handlers: Record<string, () => Promise<void>> = {
    node_heartbeat: async () => {
      if (!node_id) return;
      await supabase
        .from('node_heartbeats')
        .upsert(
          { node_id, payload: p, updated_at: new Date().toISOString() },
          { onConflict: 'node_id' }
        );
    },
    run_started: async () => {
      if (!run_id) return;
      await supabase
        .from('runs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', run_id);
    },
    task_started: async () => {
      if (!run_id || !node_id) return;
      const device_id = p.device_id as string;
      const runtime_handle = p.runtime_handle as string | undefined;
      const { data: existing } = await supabase
        .from('device_tasks')
        .select('id')
        .eq('run_id', run_id)
        .eq('device_id', device_id)
        .maybeSingle();
      if (existing?.id) {
        await supabase
          .from('device_tasks')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
            node_id,
            runtime_handle: runtime_handle ?? null,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('device_tasks').insert({
          run_id,
          node_id,
          device_serial: device_id,
          device_id,
          runtime_handle: runtime_handle ?? null,
          status: 'running',
          started_at: new Date().toISOString(),
        });
      }
    },
    task_finished: async () => {
      if (!run_id || !node_id) return;
      const device_id = p.device_id as string;
      const status = (p.status as string) === 'succeeded' ? 'completed' : 'failed';
      const timings = p.timings as { startedAt?: number; endedAt?: number } | undefined;
      const artifact = p.artifact as { storage_path?: string; public_url?: string } | undefined;
      const { data: task } = await supabase
        .from('device_tasks')
        .select('id')
        .eq('run_id', run_id)
        .eq('device_id', device_id)
        .maybeSingle();
      if (task?.id) {
        await supabase
          .from('device_tasks')
          .update({
            status,
            failure_reason: (p.failure_reason as string) ?? null,
            error_message: (p.error_message as string) ?? null,
            finished_at: timings?.endedAt
              ? new Date(timings.endedAt).toISOString()
              : new Date().toISOString(),
          })
          .eq('id', task.id);
        if (artifact?.storage_path) {
          await supabase.from('artifacts').insert({
            device_task_id: task.id,
            run_id,
            node_id,
            device_id,
            storage_path: artifact.storage_path,
            public_url: artifact.public_url ?? null,
          });
        }
      }
    },
    run_finished: async () => {
      if (!run_id) return;
      const summary = p.summary as { succeeded?: number; failed?: number; timeout?: number };
      const hasFailures = (summary?.failed ?? 0) + (summary?.timeout ?? 0) > 0;
      await supabase
        .from('runs')
        .update({
          status: hasFailures ? 'completed_with_errors' : 'completed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', run_id);
    },
  };

  const handler = handlers[type];
  if (handler) await handler();

  return NextResponse.json({ ok: true });
}
