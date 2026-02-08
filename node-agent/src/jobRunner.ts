/**
 * Run one pull job: skipped => callback only; executed => adb + screenshot + upload + callbacks.
 * All callbacks: event_id (idempotent), lease_token, run_id, device_index.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';
import type { PullJob } from './jobTypes.js';
import type { CallbackBuffer } from './callbackBuffer.js';
import { runAdbScript } from './adbExecutor.js';
import { buildArtifactPath, uploadScreenshot } from './storage.js';
import { screen as vendorScreen } from './vendorAdapter.js';
import { readFileSync } from 'node:fs';

const UPLOAD_TIMEOUT_MS = 30_000;
const SCREENSHOT_TIMEOUT_MS = 15_000;

function eventId(type: string, job: PullJob): string {
  return `${type}-${job.run_id}-${job.device_index}-${job.step_index}-${job.step_id}`;
}

async function sendCallback(
  callback: CallbackBuffer,
  job: PullJob,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body = {
    event_id: eventId(type, job),
    type,
    payload: {
      run_id: job.run_id,
      node_id: config.nodeId,
      device_index: job.device_index,
      device_id: job.device_id,
      lease_token: job.lease.token,
      ...payload,
    },
  };
  await callback.push({
    url: `${config.backendUrl}/api/nodes/callback`,
    headers: { Authorization: `Bearer ${config.sharedSecret}` },
    body,
    run_id: job.run_id,
    node_id: config.nodeId,
    device_serial: job.device_id,
  });
}

export async function runJob(job: PullJob, callback: CallbackBuffer): Promise<void> {
  const { run_id, device_index, device_id, runtime_handle, step_index, step_id, step_type, decision } = job;

  if (decision === 'skipped') {
    await sendCallback(callback, job, 'run_step_update', {
      step: { step_index, step_id, step_type, status: 'skipped', decision: 'skipped' },
    });
    logInfo('Job skipped (decision)', { run_id, device_index, step_index });
    return;
  }

  const handle = runtime_handle ?? device_id;
  await sendCallback(callback, job, 'task_started', {
    device_id,
    runtime_handle: handle,
    device_index,
  });

  const startedAt = Date.now();

  try {
    if (step_type === 'adb' && job.step_command) {
      const timeoutMs = job.timeout_ms ?? 30_000;
      const retry = job.retry_count ?? 1;
      const { ok, lastError } = await runAdbScript(handle, job.step_command, timeoutMs, retry);
      if (!ok) {
        await sendCallback(callback, job, 'run_step_update', {
          step: {
            step_index,
            step_id,
            step_type,
            status: 'failed',
            decision: 'executed',
            error_message: lastError ?? 'adb failed',
          },
        });
        await sendCallback(callback, job, 'task_finished', {
          device_id,
          runtime_handle: handle,
          device_index,
          status: 'failed',
          error_message: lastError,
          timings: { startedAt, endedAt: Date.now() },
        });
        return;
      }
    }

    await sendCallback(callback, job, 'run_step_update', {
      step: { step_index, step_id, step_type, status: 'running', decision: 'executed' },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const savePath = `/tmp/doai-${run_id}-${device_index}-${timestamp}.png`;
    await Promise.race([
      vendorScreen(handle, savePath),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT_MS)),
    ]);

    let buffer: Buffer;
    try {
      buffer = readFileSync(savePath);
    } catch (e) {
      logError('Screenshot read failed', e as Error, { run_id, device_index });
      await sendCallback(callback, job, 'task_finished', {
        device_id,
        runtime_handle: handle,
        device_index,
        status: 'failed',
        error_message: 'screenshot read failed',
        timings: { startedAt, endedAt: Date.now() },
      });
      return;
    }

    const storagePath = buildArtifactPath(run_id, device_index, timestamp);
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
    const uploadOk = await Promise.race([
      uploadScreenshot(supabase, 'artifacts', storagePath, buffer, run_id, config.nodeId, device_id),
      new Promise<{ ok: boolean }>((res) => setTimeout(() => res({ ok: false }), UPLOAD_TIMEOUT_MS)),
    ]);

    if (!uploadOk.ok) {
      await sendCallback(callback, job, 'task_finished', {
        device_id,
        runtime_handle: handle,
        device_index,
        status: 'failed',
        error_message: 'upload failed',
        timings: { startedAt, endedAt: Date.now() },
      });
      return;
    }

    await sendCallback(callback, job, 'artifact_created', {
      artifact: { kind: 'screenshot', storage_path: storagePath },
      device_id,
    });

    const endedAt = Date.now();
    await sendCallback(callback, job, 'run_step_update', {
      step: {
        step_index,
        step_id,
        step_type,
        status: 'succeeded',
        decision: 'executed',
      },
    });
    await sendCallback(callback, job, 'task_finished', {
      device_id,
      runtime_handle: handle,
      device_index,
      status: 'succeeded',
      timings: { startedAt, endedAt },
      artifact: { storage_path: storagePath },
    });

    logInfo('Job completed', { run_id, device_index, step_index });
  } catch (err) {
    logError('Job failed', err as Error, { run_id, device_index });
    await sendCallback(callback, job, 'task_finished', {
      device_id,
      runtime_handle: handle,
      device_index,
      status: 'failed',
      error_message: (err as Error).message,
      timings: { startedAt, endedAt: Date.now() },
    });
  }
}
