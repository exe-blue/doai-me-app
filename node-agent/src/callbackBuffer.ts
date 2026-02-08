/**
 * DoAi.Me MVP — Callback buffer + retry; event_id in envelope; disk-backed queue
 */

import { logWarn, logError } from './logger.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export type CallbackPayload = {
  url: string;
  body: { event_id: string; type: string; payload: Record<string, unknown> };
  headers: Record<string, string>;
  run_id?: string;
  node_id?: string;
  device_serial?: string;
};

/** Reuse same event_id on retry for idempotency (server dedupes by event_id). */

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
const MAX_RETRIES = 5;
const QUEUE_DIR = join(process.cwd(), 'data');
const QUEUE_FILE = join(QUEUE_DIR, 'callback-queue.jsonl');

function ensureQueueDir(): void {
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true });
}

function appendToDisk(payload: CallbackPayload): void {
  ensureQueueDir();
  const line = JSON.stringify(payload) + '\n';
  writeFileSync(QUEUE_FILE, line, { flag: 'a' });
}

function readFromDisk(): CallbackPayload[] {
  if (!existsSync(QUEUE_FILE)) return [];
  const content = readFileSync(QUEUE_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  return lines.map((l) => JSON.parse(l) as CallbackPayload);
}

function writeToDisk(items: CallbackPayload[]): void {
  ensureQueueDir();
  writeFileSync(QUEUE_FILE, items.map((i) => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''));
}

export class CallbackBuffer {
  private buffer: CallbackPayload[] = [];
  private retrying = false;

  async push(payload: CallbackPayload): Promise<void> {
    const ok = await this.trySend(payload);
    if (!ok) {
      this.buffer.push(payload);
      appendToDisk(payload);
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
    setTimeout(() => this.flushRetry(), RETRY_DELAYS_MS[0]);
  }

  private async flushRetry(): Promise<void> {
    this.retrying = false;
    const disk = readFromDisk();
    const items = [...this.buffer, ...disk];
    this.buffer = [];
    writeToDisk([]);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      if (attempt > 0) await new Promise((r) => setTimeout(r, delay));

      const remaining: CallbackPayload[] = [];
      for (const item of items) {
        const ok = await this.trySend(item);
        if (!ok) remaining.push(item);
      }
      if (remaining.length === 0) break;
      logWarn(`Callback retry ${attempt + 1}/${MAX_RETRIES}, ${remaining.length} pending`);
      writeToDisk(remaining);
    }
  }

  /** Load persisted items from disk (call on startup) */
  loadFromDisk(): void {
    const items = readFromDisk();
    if (items.length > 0) {
      this.buffer.push(...items);
      writeToDisk([]);
      this.scheduleRetry();
    }
  }
}
