/**
 * Workflow DSL v1 — Sequential executor
 * execute → verify (if needed) → log/persist
 * timeout → onFailure (stop | continue | retry); retry up to retryCount
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { NormalizedStep } from './workflowDsl.js';
import { logInfo, logError } from './logger.js';
import { config } from './config.js';
import { screen as vendorScreen } from './vendorAdapter.js';
import { buildStoragePath, uploadScreenshot } from './storage.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ExecutorContext = {
  runtime_handle: string;
  device_id: string;
  run_id: string;
  youtube_video_id: string;
  task_id: string;
  supabase: SupabaseClient;
  /** Set by executor after screenshot step for upload step */
  lastScreenshotPath?: string;
  lastScreenshotTimestamp?: number;
};

export type StepResult = { ok: true; artifact?: Record<string, unknown> } | { ok: false; failure_reason: string; error_message?: string };

function runWithTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Step timeout')), ms)
    ),
  ]);
}

async function executeAdb(ctx: ExecutorContext, step: NormalizedStep): Promise<StepResult> {
  const cmd = step.kind === 'adb' ? step.command : '';
  if (!cmd) return { ok: false, failure_reason: 'vendor_ws_error', error_message: 'Missing adb command' };
  try {
    if (cmd === 'devices') {
      execSync('adb devices', { encoding: 'utf-8', timeout: Math.min(step.timeoutMs, 15_000) });
      return { ok: true };
    }
    execSync(`adb -s ${ctx.runtime_handle} shell ${cmd}`, {
      encoding: 'utf-8',
      timeout: step.timeoutMs,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('ADB step failed', err as Error, { run_id: ctx.run_id, device_id: ctx.device_id });
    return { ok: false, failure_reason: 'vendor_ws_error', error_message: msg };
  }
}

async function executeVendor(ctx: ExecutorContext, step: NormalizedStep): Promise<StepResult> {
  if (step.kind !== 'vendor') return { ok: false, failure_reason: 'unknown' };
  if (step.action === 'list') {
    return { ok: true };
  }
  if (step.action === 'screen') {
    const timestamp = Math.floor(Date.now() / 1000);
    const savePath = `/tmp/doai-${ctx.run_id}-${ctx.device_id}-${timestamp}.png`;
    try {
      await vendorScreen(ctx.runtime_handle, savePath);
      (ctx as ExecutorContext & { lastScreenshotPath: string }).lastScreenshotPath = savePath;
      (ctx as ExecutorContext & { lastScreenshotTimestamp: number }).lastScreenshotTimestamp = timestamp;
      return { ok: true };
    } catch (err) {
      logError('Vendor screen failed', err as Error, { run_id: ctx.run_id, device_id: ctx.device_id });
      return { ok: false, failure_reason: 'screenshot_error', error_message: (err as Error).message };
    }
  }
  if (step.action === 'login') {
    return { ok: true };
  }
  return { ok: false, failure_reason: 'unknown', error_message: 'Unsupported vendor action' };
}

async function executeUpload(ctx: ExecutorContext, step: NormalizedStep): Promise<StepResult> {
  if (step.kind !== 'upload') return { ok: false, failure_reason: 'unknown' };
  const path = ctx.lastScreenshotPath;
  const ts = ctx.lastScreenshotTimestamp ?? Math.floor(Date.now() / 1000);
  if (!path) {
    return { ok: false, failure_reason: 'upload_error', error_message: 'No screenshot to upload' };
  }
  let buffer: Buffer;
  try {
    buffer = readFileSync(path);
  } catch (e) {
    logError('Screenshot file read failed', e as Error, { run_id: ctx.run_id, device_id: ctx.device_id });
    return { ok: false, failure_reason: 'screenshot_error', error_message: 'Failed to read screenshot file' };
  }
  const storagePath = buildStoragePath(
    ctx.youtube_video_id,
    config.nodeId,
    ctx.device_id,
    ctx.run_id,
    ts
  );
  const ok = await uploadScreenshot(
    ctx.supabase,
    'artifacts',
    storagePath,
    buffer,
    ctx.run_id,
    config.nodeId,
    ctx.device_id
  );
  if (!ok.ok) return { ok: false, failure_reason: 'upload_error' };
  return {
    ok: true,
    artifact: { kind: 'screenshot', local_path: path, storage_path: storagePath, public_url: null },
  };
}

async function executeJs(_ctx: ExecutorContext, _step: NormalizedStep): Promise<StepResult> {
  return { ok: false, failure_reason: 'unknown', error_message: 'js step not implemented' };
}

async function executeStep(ctx: ExecutorContext, step: NormalizedStep): Promise<StepResult> {
  if (step.kind === 'adb') return runWithTimeout(step.timeoutMs, () => executeAdb(ctx, step));
  if (step.kind === 'vendor') return runWithTimeout(step.timeoutMs, () => executeVendor(ctx, step));
  if (step.kind === 'upload') return runWithTimeout(step.timeoutMs, () => executeUpload(ctx, step));
  if (step.kind === 'js') return runWithTimeout(step.timeoutMs, () => executeJs(ctx, step));
  return { ok: false, failure_reason: 'unknown' };
}

export type RunStepsResult =
  | { ok: true; artifact?: Record<string, unknown> }
  | { ok: false; failure_reason: string; error_message?: string; stepId?: string };

export type StepHooks = {
  onStepStart?: (stepId: string) => Promise<void>;
  onStepDone?: (stepId: string) => Promise<void>;
};

/**
 * Run steps in order. execute → on failure apply onFailure (stop / continue / retry).
 * retry: retry up to retryCount then stop.
 */
export async function runSteps(
  steps: NormalizedStep[],
  ctx: ExecutorContext,
  hooks?: StepHooks
): Promise<RunStepsResult> {
  for (const step of steps) {
    await hooks?.onStepStart?.(step.id);

    let lastResult: StepResult = { ok: false, failure_reason: 'unknown' };
    let attempts = 0;
    const maxAttempts = step.onFailure === 'retry' ? 1 + step.retryCount : 1;

    while (attempts < maxAttempts) {
      lastResult = await executeStep(ctx, step);
      if (lastResult.ok) break;
      attempts++;
      if (attempts < maxAttempts) {
        logInfo(`Step ${step.id} failed, retry ${attempts}/${maxAttempts}`, {
          run_id: ctx.run_id,
          device_id: ctx.device_id,
        });
      }
    }

    await hooks?.onStepDone?.(step.id);

    if (!lastResult.ok) {
      if (step.onFailure === 'continue') {
        logInfo(`Step ${step.id} failed (continue)`, { run_id: ctx.run_id, device_id: ctx.device_id });
        continue;
      }
      return {
        ok: false,
        failure_reason: lastResult.failure_reason ?? 'unknown',
        error_message: lastResult.error_message,
        stepId: step.id,
      };
    }

    if (lastResult.ok && lastResult.artifact) {
      (ctx as ExecutorContext & { lastArtifact?: Record<string, unknown> }).lastArtifact = lastResult.artifact;
    }
  }

  const artifact = (ctx as ExecutorContext & { lastArtifact?: Record<string, unknown> }).lastArtifact;
  return { ok: true, artifact };
}
