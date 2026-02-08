/**
 * DoAi.Me MVP — Node Agent (TS)
 * Device-dedicated queues; 20 slots; round-robin; callback model (push status/artifacts)
 */

import { WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { Orchestrator } from './orchestrator.js';
import { logInfo, logError } from './logger.js';
import type { WorkflowPayload } from './queue.js';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

// Execute Workflow: bootstrap -> login -> screenshot -> upload -> report (callback)
async function executeWorkflow(payload: WorkflowPayload, device_serial: string): Promise<void> {
  const { run_id, youtube_video_id, workflow_id } = payload;
  const node_id = config.nodeId;

  logInfo(`Executing workflow: video=${youtube_video_id} workflow=${workflow_id}`, {
    run_id,
    node_id,
    device_serial,
  });

  // TODO: Load workflow definition from Supabase; run steps (adb bootstrap -> login -> screenshot -> upload)
  // TODO: Callback model: push status/artifacts to backend with buffering/retry on failure
  const ws = new WebSocket(config.vendorWsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });

  ws.close();

  // TODO: Upload to Supabase; path: {youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png
}

const orchestrator = new Orchestrator(executeWorkflow);

async function connectVendorWs(): Promise<void> {
  logInfo('Connecting to vendor WS', { node_id: config.nodeId });
  const ws = new WebSocket(config.vendorWsUrl);
  ws.on('open', () => logInfo('Vendor WS connected', { node_id: config.nodeId }));
  ws.on('error', (err) => logError('Vendor WS error', err, { node_id: config.nodeId }));
}

async function main(): Promise<void> {
  logInfo('Node Agent starting', { node_id: config.nodeId });

  await connectVendorWs();

  // TODO: Poll Backend for pending runs; enqueue Workflow per device (device-dedicated queues)
  // Example: orchestrator.enqueue('DEV001', { run_id, youtube_video_id, device_serial: 'DEV001', workflow_id, timeout_overrides, global_timeout_ms });
}

main().catch((err) => {
  logError('Fatal', err, { node_id: config.nodeId });
  process.exit(1);
});
