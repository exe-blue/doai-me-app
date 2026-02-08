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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const supabase = createClient(url, key);

  const { error: insertEventErr } = await supabase
    .from('callback_events')
    .insert({ event_id });

  if (insertEventErr) {
    if (insertEventErr.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[callback] event insert failed', insertEventErr);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  const p = payload;
  const run_id = typeof p.run_id === 'string' ? p.run_id : undefined;
  const node_id = typeof p.node_id === 'string' ? p.node_id : undefined;
  const device_index = typeof p.device_index === 'number' ? p.device_index : null;

  const handlers: Record<string, () => Promise<void>> = {
    device_heartbeat: async () => {
      const heartbeat = p.heartbeat as { last_seen?: string } | undefined;
      const last_seen = heartbeat?.last_seen ?? new Date().toISOString();
      if (device_index !== null) {
        await supabase
          .from('devices')
          .update({ last_seen_at: last_seen, last_error_message: null })
          .eq('index_no', device_index);
      } else if (node_id) {
        await supabase
          .from('devices')
          .update({ last_seen_at: last_seen, last_error_message: null })
          .eq('node_id', node_id);
      }
    },
    run_step_update: async () => {
      if (!run_id || device_index === null) return;
      const step = p.step as {
        step_index?: number;
        step_id?: string;
        step_type?: string;
        status?: string;
        probability?: number;
        decision?: string;
        error_message?: string | null;
      } | undefined;
      if (step?.step_index == null || step?.step_id == null) return;
      const step_index = Number(step.step_index);
      const step_id = String(step.step_id);
      const step_type = (step.step_type as string) ?? 'js';
      const status = (step.status as string) ?? 'running';
      await supabase.from('run_steps').insert({
        run_id,
        device_index,
        step_index,
        step_id,
        step_type,
        status,
        probability: typeof step.probability === 'number' ? step.probability : 1,
        decision: step.decision ?? null,
        error_message: step.error_message ?? null,
        started_at: status === 'running' || status === 'succeeded' || status === 'failed' ? new Date().toISOString() : null,
        finished_at: status === 'succeeded' || status === 'failed' ? new Date().toISOString() : null,
      });
    },
    artifact_created: async () => {
      if (!run_id) return;
      const artifact = p.artifact as { kind?: string; storage_path?: string } | undefined;
      const kind = (artifact?.kind as string) ?? 'screenshot';
      const storage_path = artifact?.storage_path;
      if (!storage_path) return;
      const device_id = (p.device_id as string) ?? null;
      await supabase.from('artifacts').insert({
        run_id,
        device_task_id: null,
        node_id: node_id ?? null,
        device_id,
        device_index: device_index ?? undefined,
        kind,
        storage_path,
        public_url: null,
      });
    },
    scan_progress: async () => {
      const scan_job_id = p.scan_job_id as string | undefined;
      const status = p.status as string | undefined;
      if (!scan_job_id || !status) return;
      await supabase.from('scan_jobs').update({ status }).eq('id', scan_job_id);
    },
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
      const device_index = typeof p.device_index === 'number' ? p.device_index : null;
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
      if (device_index !== null) {
        await supabase.from('run_device_states').upsert(
          {
            run_id,
            device_index,
            status: 'running',
            current_step_index: 0,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'run_id,device_index' }
        );
      }
    },
    task_finished: async () => {
      if (!run_id || !node_id) return;
      const device_id = p.device_id as string;
      const status = (p.status as string) === 'succeeded' ? 'completed' : 'failed';
      const rdsStatus = status === 'completed' ? 'succeeded' : 'failed';
      const device_index = typeof p.device_index === 'number' ? p.device_index : null;
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
            device_index: device_index ?? undefined,
            kind: 'screenshot',
            storage_path: artifact.storage_path,
            public_url: artifact.public_url ?? null,
          });
        }
      }
      if (device_index !== null) {
        await supabase.from('run_device_states').upsert(
          {
            run_id,
            device_index,
            status: rdsStatus,
            last_seen: new Date().toISOString(),
            last_error_message: (p.error_message as string) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'run_id,device_index' }
        );
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

  let handler: (() => Promise<void>) | undefined;
  if (typeof type === 'string' && Object.hasOwn(handlers, type)) {
    const possibleHandler = handlers[type];
    if (typeof possibleHandler === 'function') {
      handler = possibleHandler;
    }
  }

  if (handler) {
    await handler();
  }

  return NextResponse.json({ ok: true });
}
