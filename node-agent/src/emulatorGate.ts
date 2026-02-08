/**
 * Emulator Health Gate — before Device Preflight.
 * (1) ADB device online for runtime_handle (2) boot_completed.
 * Optional: auto-start AVD if env EMULATOR_AVD set; wait for stable (max EMULATOR_GATE_WAIT_MS).
 */

import { execSync, spawn } from 'node:child_process';
import { logInfo, logError } from './logger.js';

const DEFAULT_GATE_WAIT_MS = 60_000;

function getGateWaitMs(): number {
  const v = process.env.EMULATOR_GATE_WAIT_MS;
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isNaN(n) || n <= 0 ? DEFAULT_GATE_WAIT_MS : Math.min(n, 120_000);
}

/** adb devices: is runtime_handle present and status "device"? */
function isAdbOnline(runtime_handle: string): boolean {
  try {
    const out = execSync('adb devices', { encoding: 'utf-8', timeout: 10_000 });
    const lines = out.split('\n').slice(1);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [serial, status] = trimmed.split(/\s+/);
      if (serial === runtime_handle && (status ?? '').toLowerCase() === 'device') return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** adb -s <handle> shell getprop sys.boot_completed == 1 */
function isBootCompleted(runtime_handle: string): boolean {
  try {
    const out = execSync(`adb -s ${runtime_handle} shell getprop sys.boot_completed`, {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return (out.trim() === '1');
  } catch {
    return false;
  }
}

/** Try to start emulator if EMULATOR_AVD is set; wait up to gateWaitMs for ADB online + boot_completed. */
async function tryStartAndWait(runtime_handle: string, gateWaitMs: number): Promise<boolean> {
  const avd = process.env.EMULATOR_AVD;
  if (!avd?.trim()) return false;

  try {
    const emu = spawn('emulator', ['-avd', avd.trim()], {
      detached: true,
      stdio: 'ignore',
    });
    emu.unref();
    logInfo('Emulator start requested', { avd: avd.trim(), runtime_handle });
  } catch (err) {
    logError('Emulator start failed', err as Error, { avd, runtime_handle });
    return false;
  }

  const deadline = Date.now() + gateWaitMs;
  const pollMs = 2_000;
  while (Date.now() < deadline) {
    if (isAdbOnline(runtime_handle) && isBootCompleted(runtime_handle)) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

export type EmulatorGateResult =
  | { ok: true }
  | { ok: false; failure_reason: 'emulator_not_online' | 'emulator_not_booted' | 'emulator_start_timeout' };

/**
 * Emulator Health Gate: ADB online for runtime_handle + boot_completed.
 * If not passing and EMULATOR_AVD is set, try start and wait; otherwise return fail.
 */
export async function emulatorHealthGate(runtime_handle: string): Promise<EmulatorGateResult> {
  if (isAdbOnline(runtime_handle)) {
    if (isBootCompleted(runtime_handle)) return { ok: true };
    const gateWaitMs = getGateWaitMs();
    const deadline = Date.now() + gateWaitMs;
    const pollMs = 2_000;
    while (Date.now() < deadline) {
      if (isBootCompleted(runtime_handle)) return { ok: true };
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return { ok: false, failure_reason: 'emulator_not_booted' };
  }

  const gateWaitMs = getGateWaitMs();
  const started = await tryStartAndWait(runtime_handle, gateWaitMs);
  if (started) return { ok: true };

  if (isAdbOnline(runtime_handle)) {
    if (isBootCompleted(runtime_handle)) return { ok: true };
    return { ok: false, failure_reason: 'emulator_not_booted' };
  }
  return { ok: false, failure_reason: 'emulator_not_online' };
}
