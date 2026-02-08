/**
 * DoAi.Me MVP Orchestration v1 — Logging
 * Every log MUST include run_id, node_id, device_serial when applicable.
 * initLogFile(path) enables appending to a file (e.g. %ProgramData%\doai\node-runner\logs\node-runner.log).
 */

import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

let logStream: ReturnType<typeof createWriteStream> | null = null;

export function initLogFile(filePath: string | undefined): void {
  if (!filePath?.trim()) return;
  try {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    logStream = createWriteStream(filePath, { flags: 'a' });
  } catch {
    logStream = null;
  }
}

function writeToFile(line: string): void {
  if (logStream?.writable) {
    try {
      logStream.write(line + '\n');
    } catch {
      /* ignore */
    }
  }
}

type LogContext = {
  run_id?: string;
  node_id?: string;
  device_serial?: string;
  device_id?: string;
  device_index?: number;
  runtime_handle?: string;
  workflow_id?: string;
  count?: number;
  avd?: string;
  status?: number;
  line?: string;
  lineIndex?: number;
  total?: number;
  attempt?: number;
  stderr?: string;
  step_index?: number;
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
  if (ctx.device_index !== undefined) parts.push(`device_index=${ctx.device_index}`);
  if (ctx.avd) parts.push(`avd=${ctx.avd}`);
  if (ctx.status !== undefined) parts.push(`status=${ctx.status}`);
  if (ctx.lineIndex !== undefined) parts.push(`lineIndex=${ctx.lineIndex}`);
  if (ctx.stderr) parts.push(`stderr=${ctx.stderr}`);
  if (ctx.step_index !== undefined) parts.push(`step_index=${ctx.step_index}`);
  return parts.length ? `[${parts.join(' ')}] ` : '';
}

export function logInfo(msg: string, ctx: LogContext = {}): void {
  const line = `${fmt(ctx)}${msg}`;
  console.log(line);
  writeToFile(line);
}

export function logWarn(msg: string, ctx: LogContext = {}): void {
  const line = `${fmt(ctx)}${msg}`;
  console.warn(line);
  writeToFile(line);
}

export function logError(msg: string, err?: unknown, ctx: LogContext = {}): void {
  const errStr = err instanceof Error ? err.message : String(err);
  const line = `${fmt(ctx)}${msg} ${errStr}`;
  console.error(line);
  writeToFile(line);
}
