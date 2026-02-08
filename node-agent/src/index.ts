/**
 * DoAi.Me MVP — Node Agent (TS)
 * Poll /api/nodes/pull (1–2s), run one job (adb + screenshot + upload), callback with event_id + lease_token.
 */

import { config } from './config.js';
import { logInfo, logError } from './logger.js';
import { CallbackBuffer } from './callbackBuffer.js';
import { runJob } from './jobRunner.js';
import type { PullResponse } from './jobTypes.js';
import { listDevices, nodePreflight } from './vendorAdapter.js';

const callbackBuffer = new CallbackBuffer();
const POLL_INTERVAL_MS = 1500;
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

async function pullAndRunOne(): Promise<void> {
  try {
    const res = await fetch(
      `${config.backendUrl}/api/nodes/pull?node_id=${encodeURIComponent(config.nodeId)}`,
      { headers: { 'X-Node-Auth': config.sharedSecret } }
    );
    if (!res.ok) return;
    const data = (await res.json()) as PullResponse;
    const jobs = data.jobs ?? [];
    if (jobs.length === 0) return;

    const job = jobs[0];
    await runJob(job, callbackBuffer);
  } catch (err) {
    logError('Pull or run failed', err as Error, { node_id: config.nodeId });
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
    await pullAndRunOne();
    setTimeout(pollLoop, POLL_INTERVAL_MS);
  };
  setTimeout(pollLoop, 0);
}

main().catch((err) => {
  logError('Fatal', err, { node_id: config.nodeId });
  process.exit(1);
});
