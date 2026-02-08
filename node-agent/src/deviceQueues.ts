/**
 * DoAi.Me MVP — Device-dedicated FIFO queues
 * Each device has its own queue. Never run concurrent tasks on same device.
 * Global scheduler: 20 slots; round-robin across eligible device queues when slot frees.
 */

import type { WorkflowPayload } from './queue.js';

export type DeviceQueueState = {
  device_serial: string;
  queue: WorkflowPayload[];
  running: boolean;
};

export class DeviceQueues {
  private queues = new Map<string, WorkflowPayload[]>();
  private running = new Set<string>();
  private lastRoundRobinIndex = 0;
  private eligibleDevices: string[] = [];

  enqueue(device_serial: string, payload: WorkflowPayload): void {
    const q = this.queues.get(device_serial) ?? [];
    q.push(payload);
    this.queues.set(device_serial, q);
    this.refreshEligible();
  }

  /** Round-robin: pick next device with pending work and not running */
  pickNext(): { device_serial: string; payload: WorkflowPayload } | null {
    this.refreshEligible();
    if (this.eligibleDevices.length === 0) return null;

    const start = this.lastRoundRobinIndex % this.eligibleDevices.length;
    for (let i = 0; i < this.eligibleDevices.length; i++) {
      const idx = (start + i) % this.eligibleDevices.length;
      const device_serial = this.eligibleDevices[idx];
      const q = this.queues.get(device_serial);
      if (q && q.length > 0 && !this.running.has(device_serial)) {
        const payload = q.shift()!;
        if (q.length === 0) this.queues.delete(device_serial);
        this.lastRoundRobinIndex = idx;
        this.running.add(device_serial);
        return { device_serial, payload };
      }
    }
    return null;
  }

  markFinished(device_serial: string): void {
    this.running.delete(device_serial);
    this.refreshEligible();
  }

  getRunningCount(): number {
    return this.running.size;
  }

  hasPending(): boolean {
    for (const q of this.queues.values()) {
      if (q.length > 0) return true;
    }
    return false;
  }

  private refreshEligible(): void {
    const devices = new Set<string>();
    for (const [d, q] of this.queues) {
      if (q.length > 0) devices.add(d);
    }
    this.eligibleDevices = [...devices];
  }
}
