/**
 * ADB script executor: multi-line, skip blank/comment, timeout and retry per line.
 */

import { spawn } from 'node:child_process';
import { logInfo, logError } from './logger.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY = 1;

function parseLines(script: string): string[] {
  return script
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function runOneLine(
  runtime_handle: string,
  line: string,
  timeoutMs: number
): Promise<{ ok: boolean; stderr?: string }> {
  return new Promise((resolve) => {
    const adb = spawn('adb', ['-s', runtime_handle, 'shell', line], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    adb.stderr?.on('data', (c) => (stderr += c.toString()));
    const t = setTimeout(() => {
      adb.kill('SIGKILL');
      resolve({ ok: false, stderr: stderr || 'timeout' });
    }, timeoutMs);
    adb.on('close', (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, stderr: stderr || undefined });
    });
    adb.on('error', (err) => {
      clearTimeout(t);
      logError('ADB spawn error', err, { runtime_handle, line });
      resolve({ ok: false, stderr: (err as Error).message });
    });
  });
}

export async function runAdbScript(
  runtime_handle: string,
  script: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  retryCount: number = DEFAULT_RETRY
): Promise<{ ok: boolean; lastError?: string }> {
  const lines = parseLines(script);
  if (lines.length === 0) return { ok: true };

  const perLineTimeout = Math.max(5_000, Math.floor(timeoutMs / Math.max(1, lines.length)));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lastErr: string | undefined;
    for (let r = 0; r <= retryCount; r++) {
      const { ok, stderr } = await runOneLine(runtime_handle, line, perLineTimeout);
      if (ok) {
        logInfo('ADB line OK', { runtime_handle, lineIndex: i + 1, total: lines.length });
        break;
      }
      lastErr = stderr;
      if (r < retryCount) {
        logInfo('ADB retry', { runtime_handle, lineIndex: i + 1, attempt: r + 1 });
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    if (lastErr) {
      logError('ADB line failed', undefined, { runtime_handle, line, stderr: lastErr });
      return { ok: false, lastError: lastErr };
    }
  }
  return { ok: true };
}
