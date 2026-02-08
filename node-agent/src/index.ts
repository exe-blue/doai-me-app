/**
 * DoAi.Me MVP — Node Agent (TS)
 * Device-dedicated queues; 20 slots; round-robin; callback model (push status/artifacts)
 */

import { config } from './config.js';
import { Orchestrator } from './orchestrator.js';
import { logInfo, logError } from './logger.js';
import type { WorkflowPayload } from './queue.js';
import { runWorkflow } from './workflowRunner.js';
import { CallbackBuffer } from './callbackBuffer.js';
import { listDevices, nodePreflight } from './vendorAdapter.js';

const callbackBuffer = new CallbackBuffer();

async function executeWorkflow(payload: WorkflowPayload, device_serial: string): Promise<void> {
  const node_id = config.nodeId;
  logInfo('Executing workflow', {
    run_id: payload.run_id,
    node_id,
    device_serial,
    workflow_id: payload.workflow_id,
  });
  await runWorkflow(
    payload,
    device_serial,
    device_serial,
    callbackBuffer
  );
}

const orchestrator = new Orchestrator(executeWorkflow);

const POLL_INTERVAL_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

async function sendHeartbeat(vendor_ws_ok: boolean, devicesCount: number): Promise<void> {
  try {
    const res = await fetch(`${config.backendUrl}/api/nodes/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.sharedSecret}`,
      },
      body: JSON.stringify({
        event_id: `heartbeat-${config.nodeId}-${Date.now()}`,
        type: 'node_heartbeat',
        payload: {
          node_id: config.nodeId,
          vendor_ws_ok,
          connected_devices_count: devicesCount,
          running_devices_count: 0,
          queue_devices_count: 0,
          timestamp: Date.now(),
        },
      }),
    });
    if (!res.ok) logError('Heartbeat failed', undefined, { status: res.status, node_id: config.nodeId });
  } catch (err) {
    logError('Heartbeat error', err as Error, { node_id: config.nodeId });
  }
}

async function pollPendingRuns(): Promise<void> {
  try {
    const res = await fetch(`${config.backendUrl}/api/nodes/pull?node_id=${encodeURIComponent(config.nodeId)}`, {
      headers: { 'X-Node-Auth': config.sharedSecret },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { pending?: Array<{
      run_id: string;
      youtubeVideoId: string | null;
      workflow_id: string;
      timeoutOverrides?: Record<string, number>;
      global_timeout_ms?: number | null;
    }> };
    const pending = data.pending ?? [];
    if (pending.length === 0) return;

    const devices = await listDevices();
    for (const run of pending) {
      for (const d of devices) {
        const device_id = d.serial;
        const payload: WorkflowPayload = {
          run_id: run.run_id,
          youtube_video_id: run.youtubeVideoId ?? 'manual',
          device_serial: device_id,
          workflow_id: run.workflow_id,
          timeout_overrides: run.timeoutOverrides,
          global_timeout_ms: run.global_timeout_ms ?? undefined,
        };
        orchestrator.enqueue(device_id, payload);
      }
    }
  } catch (err) {
    logError('Poll pending runs failed', err, { node_id: config.nodeId });
  }
}

async function main(): Promise<void> {
  logInfo('Node Agent starting', { node_id: config.nodeId });

  callbackBuffer.loadFromDisk();

  let vendorWsOk = false;
  let devicesCount = 0;
  try {
    const preflight = await nodePreflight();
    vendorWsOk = preflight.ok;
    if (preflight.ok) {
      const devices = await listDevices();
      devicesCount = devices.length;
    }
    if (!preflight.ok) {
      logError('Node preflight failed (vendor WS/list)', undefined, { node_id: config.nodeId });
    }
  } catch {
    // leave vendorWsOk false
  }

  await sendHeartbeat(vendorWsOk, devicesCount);
  setInterval(async () => {
    let ok = false;
    let count = 0;
    try {
      const preflight = await nodePreflight();
      ok = preflight.ok;
      if (ok) {
        const devices = await listDevices();
        count = devices.length;
      }
    } catch {
      // leave ok false
    }
    await sendHeartbeat(ok, count);
  }, HEARTBEAT_INTERVAL_MS);

  setInterval(pollPendingRuns, POLL_INTERVAL_MS);
  await pollPendingRuns();
}

main().catch((err) => {
  logError('Fatal', err, { node_id: config.nodeId });
  process.exit(1);
});
