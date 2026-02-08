/**
 * DoAi.Me MVP Orchestration v1 — Device-level lock
 * One task per device at a time
 */

const locks = new Map<string, boolean>();

export function acquire(device_serial: string): boolean {
  if (locks.get(device_serial)) return false;
  locks.set(device_serial, true);
  return true;
}

export function release(device_serial: string): void {
  locks.delete(device_serial);
}

export function isLocked(device_serial: string): boolean {
  return locks.get(device_serial) === true;
}
