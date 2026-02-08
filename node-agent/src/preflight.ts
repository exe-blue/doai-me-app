/**
 * Device Preflight — adb devices → unauthorized/offline/missing → fail-fast
 * Node Preflight — vendor WS + list (see vendorAdapter.nodePreflight)
 */

import { execSync } from 'child_process';
import { logInfo, logError } from './logger.js';

export type AdbDeviceStatus = 'device' | 'unauthorized' | 'offline' | 'missing';

export type DevicePreflightResult =
  | { ok: true; status: 'device' }
  | { ok: false; failure_reason: 'needs_usb_authorization' | 'adb_offline' | 'adb_missing'; status: AdbDeviceStatus };

/**
 * Device Preflight: run `adb devices` and check line for runtime_handle.
 * unauthorized → needs_usb_authorization (fail-fast)
 */
export function devicePreflight(runtime_handle: string): DevicePreflightResult {
  try {
    const out = execSync('adb devices', { encoding: 'utf-8', timeout: 15_000 });
    const lines = out.split('\n').slice(1);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [serial, status] = trimmed.split(/\s+/);
      if (serial !== runtime_handle) continue;
      const s = (status ?? 'missing').toLowerCase();
      if (s === 'device') return { ok: true, status: 'device' };
      if (s === 'unauthorized') return { ok: false, failure_reason: 'needs_usb_authorization', status: 'unauthorized' };
      if (s === 'offline') return { ok: false, failure_reason: 'adb_offline', status: 'offline' };
      return { ok: false, failure_reason: 'adb_missing', status: 'missing' };
    }
    return { ok: false, failure_reason: 'adb_missing', status: 'missing' };
  } catch (err) {
    logError('Device preflight: adb devices failed', err, { runtime_handle });
    return { ok: false, failure_reason: 'adb_missing', status: 'missing' };
  }
}
