/**
 * Pull job shape (server contract). jobs[0].lease.token required; decision skipped => callback only.
 */

export type PullJob = {
  run_id: string;
  device_index: number;
  device_id: string;
  runtime_handle: string | null;
  step_index: number;
  step_id: string;
  step_type: string;
  step_title?: string | null;
  step_command?: string | null;
  decision: 'executed' | 'skipped';
  probability: number;
  lease: { token: string };
  params?: Record<string, unknown>;
  timeout_ms?: number | null;
  on_failure?: string;
  retry_count?: number;
  step_params?: Record<string, unknown>;
  timeout_overrides?: Record<string, number>;
  global_timeout_ms?: number | null;
};

export type PullResponse = {
  now: string;
  jobs: PullJob[];
};
