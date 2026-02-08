/**
 * DoAi.Me MVP — Node Agent (TS)
 * Poll /api/nodes/pull (1–2s), run one job (adb + screenshot + upload), callback with event_id + lease_token.
 * 동시 실행 1개, 실패 시 15초 후 스킵(다음 폴링).
 */

import { config, GRACE_WAIT_MS } from './config.js';
import { logInfo, logError } from './logger.js';
import { CallbackBuffer } from './callbackBuffer.js';
import { runJob } from './jobRunner.js';
import type { PullResponse } from './jobTypes.js';
import { listDevices, nodePreflight } from './vendorAdapter.js';

const callbackBuffer = new CallbackBuffer();
const POLL_INTERVAL_MS = config.pollIntervalMs;
const HEARTBEAT_INTERVAL_MS = 30_000;

async function sendHeartbeat(vendor_ws_ok: boolean, devicesCount: number): Promise<void> {
  try {
    const event_id = `heartbeat-${config.nodeId}-${Date.now()}`;
    const res = await fetch(`${config.backendUrl}/api/nodes/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.sharedSecret}`,
      },
      body: JSON.stringify({
        event_id,
        type: 'node_heartbeat',
        payload: {
          node_id: config.nodeId,
          runner_version: config.runnerVersion,
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

/** 'none' = no job, 'ok' = job succeeded, 'fail' = job failed or throw. 실패 시 15초 후 스킵용. */
async function pullAndRunOne(): Promise<'none' | 'ok' | 'fail'> {
  try {
    const res = await fetch(
      `${config.backendUrl}/api/nodes/pull?node_id=${encodeURIComponent(config.nodeId)}`,
      { headers: { 'X-Node-Auth': config.sharedSecret } }
    );
    if (!res.ok) return 'none';
    const data = (await res.json()) as PullResponse;
    const jobs = data.jobs ?? [];
    if (jobs.length === 0) return 'none';

    const job = jobs[0];
    const ok = await runJob(job, callbackBuffer);
    return ok ? 'ok' : 'fail';
  } catch (err) {
    logError('Pull or run failed', err as Error, { node_id: config.nodeId });
    return 'fail';
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

  const pollLoop = async (): Promise<void> => {
    const result = await pullAndRunOne();
    const delay = result === 'fail' ? GRACE_WAIT_MS : POLL_INTERVAL_MS;
    setTimeout(pollLoop, delay);
  };
  setTimeout(pollLoop, 0);
}

main().catch((err) => {
  logError('Fatal', err, { node_id: config.nodeId });
  process.exit(1);
});
