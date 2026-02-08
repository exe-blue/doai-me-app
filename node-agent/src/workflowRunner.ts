/**
 * Workflow Runner — DSL steps: Preflight → Bootstrap → LoginFlow → Screenshot → Upload; callbacks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';
import type { WorkflowPayload } from './queue.js';
import { devicePreflight } from './preflight.js';
import { listDevices, screen as vendorScreen } from './vendorAdapter.js';
import { buildStoragePath, uploadScreenshot } from './storage.js';
import { readFileSync } from 'fs';
import { CallbackBuffer } from './callbackBuffer.js';

const STEP_TIMEOUT_MIN_MS = 5_000;
const STEP_TIMEOUT_MAX_MS = 600_000;

function getStepTimeout(
  stepId: string,
  defaultMs: number,
  overrides?: Record<string, number>
): number {
  const override = overrides?.[stepId];
  const ms = typeof override === 'number' ? override : defaultMs;
  return Math.max(STEP_TIMEOUT_MIN_MS, Math.min(STEP_TIMEOUT_MAX_MS, ms));
}

export type RunContext = {
  payload: WorkflowPayload;
  device_id: string;
  runtime_handle: string;
  task_id: string;
  callback: CallbackBuffer;
  supabase: SupabaseClient;
};

export async function runWorkflow(
  payload: WorkflowPayload,
  device_id: string,
  runtime_handle: string,
  callback: CallbackBuffer
): Promise<{ ok: boolean; failure_reason?: string }> {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const task_id = `task-${payload.run_id}-${device_id}`;
  const ctx: RunContext = {
    payload,
    device_id,
    runtime_handle,
    task_id,
    callback,
    supabase,
  };

  const startedAt = Date.now();
  const timeoutMs = payload.global_timeout_ms ?? config.taskTimeoutMs;

  const emit = async (
    type: string,
    payloadOverride: Record<string, unknown>
  ) => {
    const event_id = `${type}-${payload.run_id}-${device_id}-${Date.now()}`;
    await callback.push({
      url: `${config.backendUrl}/api/nodes/callback`,
      headers: {
        Authorization: `Bearer ${config.sharedSecret}`,
      },
      body: { event_id, type, payload: { ...payloadOverride, run_id: payload.run_id, node_id: config.nodeId } },
      run_id: payload.run_id,
      node_id: config.nodeId,
      device_serial: device_id,
    });
  };

  await emit('task_started', {
    task_id,
    device_id,
    runtime_handle,
    workflow_id: payload.workflow_id,
    timeoutMs,
    timestamp: startedAt,
  });

  try {
    const preflight = devicePreflight(runtime_handle);
    if (!preflight.ok) {
      await emit('task_finished', {
        task_id,
        device_id,
        runtime_handle,
        status: 'failed',
        failure_reason: preflight.failure_reason,
        timings: { startedAt, endedAt: Date.now() },
        timestamp: Date.now(),
      });
      return { ok: false, failure_reason: preflight.failure_reason };
    }

    const youtubeVideoId = payload.youtube_video_id ?? 'manual';
    const overrides = payload.timeout_overrides ?? {};

    const preflightTimeout = getStepTimeout('PREFLIGHT', 20_000, overrides);
    const screenshotTimeout = getStepTimeout('SCREENSHOT', 30_000, overrides);
    const uploadTimeout = getStepTimeout('UPLOAD', 60_000, overrides);

    await emit('task_progress', {
      task_id,
      device_id,
      step: 'PREFLIGHT',
      status: 'done',
      timestamp: Date.now(),
    });

    await emit('task_progress', {
      task_id,
      device_id,
      step: 'BOOTSTRAP',
      status: 'running',
      timestamp: Date.now(),
    });
    await emit('task_progress', {
      task_id,
      device_id,
      step: 'BOOTSTRAP',
      status: 'done',
      timestamp: Date.now(),
    });

    await emit('task_progress', {
      task_id,
      device_id,
      step: 'LOGIN_FLOW',
      status: 'running',
      timestamp: Date.now(),
    });
    await emit('task_progress', {
      task_id,
      device_id,
      step: 'LOGIN_FLOW',
      status: 'done',
      timestamp: Date.now(),
    });

    await emit('task_progress', {
      task_id,
      device_id,
      step: 'SCREENSHOT',
      status: 'running',
      timestamp: Date.now(),
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const savePath = `/tmp/doai-${payload.run_id}-${device_id}-${timestamp}.png`;
    await Promise.race([
      vendorScreen(runtime_handle, savePath),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Screenshot timeout')), screenshotTimeout)
      ),
    ]);

    let buffer: Buffer;
    try {
      buffer = readFileSync(savePath);
    } catch (e) {
      logError('Screenshot file read failed', e as Error, {
        run_id: payload.run_id,
        device_id,
      });
      await emit('task_finished', {
        task_id,
        device_id,
        runtime_handle,
        status: 'failed',
        failure_reason: 'screenshot_error',
        error_message: 'Failed to read screenshot file',
        timings: { startedAt, endedAt: Date.now() },
        timestamp: Date.now(),
      });
      return { ok: false, failure_reason: 'screenshot_error' };
    }

    const storagePath = buildStoragePath(
      youtubeVideoId,
      config.nodeId,
      device_id,
      payload.run_id,
      timestamp
    );

    const uploadOk = await Promise.race([
      uploadScreenshot(
        supabase,
        'artifacts',
        storagePath,
        buffer,
        payload.run_id,
        config.nodeId,
        device_id
      ),
      new Promise<{ ok: boolean }>((resolve) =>
        setTimeout(() => resolve({ ok: false }), uploadTimeout)
      ),
    ]);

    if (!uploadOk.ok) {
      await emit('task_finished', {
        task_id,
        device_id,
        runtime_handle,
        status: 'failed',
        failure_reason: 'upload_error',
        timings: { startedAt, endedAt: Date.now() },
        timestamp: Date.now(),
      });
      return { ok: false, failure_reason: 'upload_error' };
    }

    const endedAt = Date.now();
    await emit('task_finished', {
      task_id,
      device_id,
      runtime_handle,
      status: 'succeeded',
      timings: { startedAt, endedAt },
      artifact: {
        kind: 'screenshot',
        local_path: savePath,
        storage_path: storagePath,
        public_url: null,
      },
      timestamp: endedAt,
    });

    return { ok: true };
  } catch (err) {
    const endedAt = Date.now();
    logError('Workflow failed', err as Error, {
      run_id: payload.run_id,
      device_id,
    });
    await emit('task_finished', {
      task_id,
      device_id,
      runtime_handle,
      status: 'failed',
      failure_reason: 'unknown',
      error_message: (err as Error).message,
      timings: { startedAt, endedAt },
      timestamp: endedAt,
    });
    return { ok: false, failure_reason: 'unknown' };
  }
}
