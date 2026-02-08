/**
 * DoAi.Me MVP — Global scheduler + device-dedicated queues
 * 20 slots; round-robin across eligible device queues; one Workflow per device at a time
 */

import { DeviceQueues } from './deviceQueues.js';
import type { WorkflowPayload } from './queue.js';
import { logInfo, logError } from './logger.js';
import { config } from './config.js';

const MAX_CONCURRENCY = config.maxConcurrency;
const TASK_TIMEOUT_MS = config.taskTimeoutMs;

type WorkflowRunner = (payload: WorkflowPayload, device_serial: string) => Promise<void>;

export class Orchestrator {
  private deviceQueues = new DeviceQueues();
  private runner: WorkflowRunner;

  constructor(runner: WorkflowRunner) {
    this.runner = runner;
  }

  /** Enqueue Workflow to device's dedicated queue */
  enqueue(device_serial: string, payload: WorkflowPayload): void {
    this.deviceQueues.enqueue(device_serial, payload);
    this.process();
  }

  private process(): void {
    while (
      this.deviceQueues.getRunningCount() < MAX_CONCURRENCY &&
      this.deviceQueues.hasPending()
    ) {
      const next = this.deviceQueues.pickNext();
      if (!next) break;

      const { device_serial, payload } = next;
      const { run_id } = payload;
      const node_id = config.nodeId;

      logInfo('Workflow started', { run_id, node_id, device_serial });

      const done = () => {
        this.deviceQueues.markFinished(device_serial);
        this.process();
      };

      const timeout = setTimeout(() => {
        logError('Workflow timeout', undefined, { run_id, node_id, device_serial });
        done();
      }, payload.global_timeout_ms ?? TASK_TIMEOUT_MS);

      this.runner(payload, device_serial)
        .then(() => {
          clearTimeout(timeout);
          logInfo('Workflow completed', { run_id, node_id, device_serial });
        })
        .catch((err) => {
          clearTimeout(timeout);
          logError('Workflow failed (fail-soft)', err, { run_id, node_id, device_serial });
        })
        .finally(done);
    }
  }
}
