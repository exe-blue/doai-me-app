/**
 * DoAi.Me MVP Orchestration v1 — FIFO queue + Workflow payload
 * Device-dedicated queues: one queue per device; global scheduler round-robins
 */

export type TaskPayload = {
  run_id: string;
  youtube_video_id: string;
  device_serial: string;
};

export type WorkflowPayload = TaskPayload & {
  workflow_id: string;
  timeout_overrides?: Record<string, number>;
  global_timeout_ms?: number;
};

export class FifoQueue<T = TaskPayload> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  /** Re-queue at front when device busy (retry soon) */
  enqueueFront(item: T): void {
    this.items.unshift(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  get size(): number {
    return this.items.length;
  }

  get empty(): boolean {
    return this.items.length === 0;
  }
}
