/**
 * DoAi.Me MVP — Callback buffer + retry
 * Node pushes status/artifacts to backend; on failure, buffer and retry
 */

import { logWarn, logError } from './logger.js';

type CallbackPayload = {
  url: string;
  body: unknown;
  headers: Record<string, string>;
  run_id?: string;
  node_id?: string;
  device_serial?: string;
};

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export class CallbackBuffer {
  private buffer: CallbackPayload[] = [];
  private retrying = false;

  async push(payload: CallbackPayload): Promise<void> {
    const ok = await this.trySend(payload);
    if (!ok) {
      this.buffer.push(payload);
      this.scheduleRetry();
    }
  }

  private async trySend(payload: CallbackPayload): Promise<boolean> {
    try {
      const res = await fetch(payload.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...payload.headers },
        body: JSON.stringify(payload.body),
      });
      return res.ok;
    } catch (err) {
      logError('Callback failed', err, {
        run_id: payload.run_id,
        node_id: payload.node_id,
        device_serial: payload.device_serial,
      });
      return false;
    }
  }

  private scheduleRetry(): void {
    if (this.retrying) return;
    this.retrying = true;
    setTimeout(() => this.flushRetry(), RETRY_DELAY_MS);
  }

  private async flushRetry(): Promise<void> {
    this.retrying = false;
    const items = [...this.buffer];
    this.buffer = [];
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      for (const item of items) {
        const ok = await this.trySend(item);
        if (!ok) this.buffer.push(item);
      }
      if (this.buffer.length === 0) break;
      logWarn(`Callback retry ${attempt + 1}/${MAX_RETRIES}, ${this.buffer.length} pending`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
