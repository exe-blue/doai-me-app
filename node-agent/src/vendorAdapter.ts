/**
 * Minimal Vendor Adapter — list, screen (savePath)
 * See docs/Minimal-Vendor-Adapter-Contract.md
 */

import { WebSocket } from 'ws';
import { logInfo, logError } from './logger.js';
import { config } from './config.js';

export type DeviceEntry = { serial: string };

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(config.vendorWsUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function send(ws: WebSocket, msg: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        ws.off('message', onMessage);
        ws.off('error', onError);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    const onError = (err: Error) => {
      ws.off('message', onMessage);
      reject(err);
    };
    ws.once('message', onMessage);
    ws.once('error', onError);
    ws.send(JSON.stringify(msg));
  });
}

/** action=list — returns list of devices with serial */
export async function listDevices(): Promise<DeviceEntry[]> {
  const ws = await connect();
  try {
    const res = await send(ws, { action: 'list' });
    const list = (res as { devices?: { serial?: string }[] })?.devices ?? [];
    return list.map((d) => ({ serial: d.serial ?? '' })).filter((d) => d.serial);
  } finally {
    ws.close();
  }
}

/** action=screen with savePath — screenshot to local path; returns path or throws */
export async function screen(
  runtime_handle: string,
  savePath: string
): Promise<{ path: string }> {
  const ws = await connect();
  try {
    const res = await send(ws, {
      action: 'screen',
      device: runtime_handle,
      savePath,
    });
    const path = (res as { path?: string })?.path ?? savePath;
    return { path };
  } catch (err) {
    logError('Vendor screen failed', err, { runtime_handle });
    throw err;
  } finally {
    ws.close();
  }
}

/** Node preflight: vendor WS + list success */
export async function nodePreflight(): Promise<{ ok: boolean }> {
  try {
    const devices = await listDevices();
    logInfo('Node preflight: vendor list OK', { node_id: config.nodeId, count: devices.length });
    return { ok: true };
  } catch (err) {
    logError('Node preflight: vendor list failed', err, { node_id: config.nodeId });
    return { ok: false };
  }
}
