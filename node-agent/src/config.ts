/**
 * DoAi.Me MVP Orchestration v1 — Node Agent config
 * MAX_CONCURRENCY_PER_NODE=20, FIFO queue, device lock, timeouts, fail-soft
 */

export const MAX_CONCURRENCY_PER_NODE = 20;
export const TASK_TIMEOUT_MS = 90_000;  // 90s task
export const UPLOAD_TIMEOUT_MS = 30_000; // 30s upload

export function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  nodeId: getEnv('NODE_ID'),
  vendorWsUrl: getEnv('VENDOR_WS_URL'),
  backendUrl: getEnv('BACKEND_URL'),
  sharedSecret: getEnv('NODE_AGENT_SHARED_SECRET'),
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  maxConcurrency: MAX_CONCURRENCY_PER_NODE,
  taskTimeoutMs: TASK_TIMEOUT_MS,
  uploadTimeoutMs: UPLOAD_TIMEOUT_MS,
} as const;
