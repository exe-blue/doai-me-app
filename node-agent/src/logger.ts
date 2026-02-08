/**
 * DoAi.Me MVP Orchestration v1 — Logging
 * Every log MUST include run_id, node_id, device_serial when applicable
 */

type LogContext = {
  run_id?: string;
  node_id?: string;
  device_serial?: string;
  device_id?: string;
  runtime_handle?: string;
  workflow_id?: string;
  count?: number;
  avd?: string;
  status?: number;
};

function fmt(ctx: LogContext): string {
  const parts: string[] = [];
  if (ctx.run_id) parts.push(`run_id=${ctx.run_id}`);
  if (ctx.node_id) parts.push(`node_id=${ctx.node_id}`);
  if (ctx.device_serial) parts.push(`device_serial=${ctx.device_serial}`);
  if (ctx.device_id) parts.push(`device_id=${ctx.device_id}`);
  if (ctx.runtime_handle) parts.push(`runtime_handle=${ctx.runtime_handle}`);
  if (ctx.workflow_id) parts.push(`workflow_id=${ctx.workflow_id}`);
  if (ctx.count !== undefined) parts.push(`count=${ctx.count}`);
  if (ctx.avd) parts.push(`avd=${ctx.avd}`);
  if (ctx.status !== undefined) parts.push(`status=${ctx.status}`);
  return parts.length ? `[${parts.join(' ')}] ` : '';
}

export function logInfo(msg: string, ctx: LogContext = {}): void {
  console.log(`${fmt(ctx)}${msg}`);
}

export function logWarn(msg: string, ctx: LogContext = {}): void {
  console.warn(`${fmt(ctx)}${msg}`);
}

export function logError(msg: string, err?: unknown, ctx: LogContext = {}): void {
  const errStr = err instanceof Error ? err.message : String(err);
  console.error(`${fmt(ctx)}${msg} ${errStr}`);
}
