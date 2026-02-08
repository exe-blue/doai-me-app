/**
 * DoAi.Me MVP Orchestration v1 — Node Agent config
 * P0 정책: 동시성 1(순차), 무응답/에러 시 grace 15s 후 다음 디바이스
 */

/** P0 권장: 1 (순차). 설정 없으면 20. */
export const MAX_CONCURRENCY_PER_NODE = Number(process.env.NODE_MAX_CONCURRENCY ?? '20');
export const TASK_TIMEOUT_MS = 90_000;  // 90s task
export const UPLOAD_TIMEOUT_MS = 30_000; // 30s upload
/** 무응답/에러 시 다음 디바이스로 넘어가기 전 대기 (P0: 15s) */
export const GRACE_WAIT_MS = 15_000;

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
  graceWaitMs: GRACE_WAIT_MS,
} as const;
