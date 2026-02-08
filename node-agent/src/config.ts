/**
 * DoAi.Me MVP — Node Agent config
 * Load from env or from --config <path> JSON file. P0: 동시성 1, grace 15s.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TASK_TIMEOUT_MS = 90_000;
export const UPLOAD_TIMEOUT_MS = 30_000;
export const GRACE_WAIT_MS = 15_000;

const DEFAULT_ADB_PATH =
  process.platform === 'win32'
    ? String.raw`C:\Program Files (x86)\xiaowei\tools\adb.exe`
    : 'adb';

export function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getEnvOptional(name: string): string | undefined {
  return process.env[name];
}

export interface ConfigFile {
  server_base_url?: string;
  node_id?: string;
  node_shared_secret?: string;
  adb_path?: string;
  poll_interval_ms?: number;
  max_jobs?: number;
  online_window_sec?: number;
  lease_sec?: number;
  artifacts_dir?: string;
  supabase_url?: string;
  supabase_service_role_key?: string;
  vendor_ws_url?: string;
}

function parseArgv(): { configPath?: string; help: boolean } {
  const argv = process.argv.slice(2);
  let configPath: string | undefined;
  let help = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--config' && argv[i + 1]) {
      configPath = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      help = true;
    }
    i++;
  }
  return { configPath, help };
}

function loadConfigFromFile(path: string): ConfigFile {
  const raw = readFileSync(resolve(path), 'utf-8');
  return JSON.parse(raw) as ConfigFile;
}

function printHelp(): void {
  const msg = `
DoAi.Me Node Runner — pull → execute → callback

Usage:
  node-runner [options]

Options:
  --config <path>   Path to config.json (default: use env vars)
  --help, -h        Show this help

Config file (JSON) keys:
  server_base_url, node_id, node_shared_secret, adb_path,
  poll_interval_ms, max_jobs, supabase_url, supabase_service_role_key,
  vendor_ws_url (optional)

Env fallbacks when using --config: BACKEND_URL, NODE_ID, NODE_AGENT_SHARED_SECRET,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VENDOR_WS_URL, ADB_PATH.
`;
  process.stdout.write(msg);
}

const { configPath, help } = parseArgv();
if (help) {
  printHelp();
  process.exit(0);
}

let fileConfig: ConfigFile = {};
if (configPath) {
  try {
    fileConfig = loadConfigFromFile(configPath);
  } catch (err) {
    console.error('Failed to load config from', configPath, err);
    process.exit(1);
  }
}

function str(key: keyof ConfigFile, envKey: string): string {
  const v = fileConfig[key];
  if (v != null && typeof v === 'string') return v;
  if (configPath) {
    const env = getEnvOptional(envKey);
    if (env) return env;
    throw new Error(`Config file and env missing: ${String(key)} / ${envKey}`);
  }
  return getEnv(envKey);
}

function strOptional(key: keyof ConfigFile, envKey: string): string | undefined {
  const v = fileConfig[key];
  if (v != null && typeof v === 'string') return v;
  return getEnvOptional(envKey);
}

function num(key: keyof ConfigFile, defaultVal: number): number {
  const v = fileConfig[key];
  if (v != null && typeof v === 'number') return v;
  return defaultVal;
}

const maxConcurrency = num('max_jobs', 1) || Number(getEnvOptional('NODE_MAX_CONCURRENCY') ?? '1');

export const RUNNER_VERSION = '0.1.0';

export const config = {
  runnerVersion: RUNNER_VERSION,
  nodeId: str('node_id', 'NODE_ID'),
  vendorWsUrl: strOptional('vendor_ws_url', 'VENDOR_WS_URL') ?? 'ws://127.0.0.1:22222/',
  backendUrl: str('server_base_url', 'BACKEND_URL').replace(/\/$/, ''),
  sharedSecret: str('node_shared_secret', 'NODE_AGENT_SHARED_SECRET'),
  supabaseUrl: strOptional('supabase_url', 'SUPABASE_URL') ?? '',
  supabaseServiceRoleKey: strOptional('supabase_service_role_key', 'SUPABASE_SERVICE_ROLE_KEY') ?? '',
  adbPath: strOptional('adb_path', 'ADB_PATH') ?? DEFAULT_ADB_PATH,
  pollIntervalMs: num('poll_interval_ms', 1500),
  maxJobs: num('max_jobs', 1),
  maxConcurrency,
  taskTimeoutMs: TASK_TIMEOUT_MS,
  uploadTimeoutMs: UPLOAD_TIMEOUT_MS,
  graceWaitMs: GRACE_WAIT_MS,
} as const;

export const MAX_CONCURRENCY_PER_NODE = maxConcurrency;
