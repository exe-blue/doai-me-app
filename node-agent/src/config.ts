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
  log_file?: string;
  poll_interval_ms?: number;
  max_jobs?: number;
  online_window_sec?: number;
  lease_sec?: number;
  artifacts_dir?: string;
  supabase_url?: string;
  supabase_service_role_key?: string;
  vendor_ws_url?: string;
}

function parseArgv(): { configPath?: string; logFile?: string; help: boolean } {
  const argv = process.argv.slice(2);
  let configPath: string | undefined;
  let logFile: string | undefined;
  let help = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--config' && argv[i + 1]) {
      configPath = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--log-file' && argv[i + 1]) {
      logFile = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--help' || arg === '-h') help = true;
    i++;
  }
  return { configPath, logFile, help };
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
  --log-file <path> Append logs to file (e.g. %%ProgramData%%\\doai\\node-runner\\logs\\node-runner.log)
  --help, -h        Show this help

Config file (JSON) keys:
  server_base_url, node_id, node_shared_secret, adb_path, log_file,
  poll_interval_ms, max_jobs, supabase_url, supabase_service_role_key,
  vendor_ws_url (optional)

Env fallbacks when using --config: BACKEND_URL, NODE_ID, NODE_AGENT_SHARED_SECRET,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VENDOR_WS_URL, ADB_PATH.
`;
  process.stdout.write(msg);
}

const { configPath, logFile: argvLogFile, help } = parseArgv();
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

/** Env key aliases. desktop-agent uses PC_ID/DOAIME_PC_ID, WORKER_TOKEN/DOAIME_WORKER_TOKEN, SERVER_URL. */
const ENV_ALIASES: Record<string, string[]> = {
  node_id: ['PC_CODE', 'PC_ID', 'DOAIME_PC_ID', 'NODE_ID'],
  server_base_url: ['API_BASE_URL', 'SERVER_URL', 'BACKEND_URL'],
  node_shared_secret: ['WORKER_API_KEY', 'WORKER_TOKEN', 'DOAIME_WORKER_TOKEN', 'NODE_AGENT_SHARED_SECRET'],
};

function str(key: keyof ConfigFile, envKey: string): string {
  const v = fileConfig[key];
  if (v != null && typeof v === 'string') return v;
  const aliases = ENV_ALIASES[key as keyof typeof ENV_ALIASES] ?? [envKey];
  for (const k of aliases) {
    const env = getEnvOptional(k);
    if (env) return env;
  }
  if (configPath) throw new Error(`Config file and env missing: ${String(key)}`);
  return getEnv(envKey);
}

function strRequiredOptional(key: keyof ConfigFile, envKeys: string[]): string {
  const v = fileConfig[key];
  if (v != null && typeof v === 'string') return v;
  for (const k of envKeys) {
    const env = getEnvOptional(k);
    if (env) return env;
  }
  return '';
}

const PLACEHOLDER_SECRET = 'REPLACE_ME';
const PLACEHOLDER_URL_PATTERNS = /<your-vercel>|REPLACE|placeholder/i;

/** Returns list of missing or invalid config (placeholder) for user-facing message. Blocks polling/scan until fixed. */
export function validateRequiredKeys(): string[] {
  const missing: string[] = [];
  const nodeId = strRequiredOptional('node_id', ['PC_CODE', 'PC_ID', 'DOAIME_PC_ID', 'NODE_ID']);
  const backend = strRequiredOptional('server_base_url', ['API_BASE_URL', 'SERVER_URL', 'BACKEND_URL']);
  const secret = strRequiredOptional('node_shared_secret', ['WORKER_API_KEY', 'WORKER_TOKEN', 'DOAIME_WORKER_TOKEN', 'NODE_AGENT_SHARED_SECRET']);
  if (!nodeId?.trim()) missing.push('PC_CODE/PC_ID or NODE_ID');
  if (!backend?.trim()) missing.push('API_BASE_URL/SERVER_URL or BACKEND_URL');
  if (!secret?.trim()) missing.push('WORKER_API_KEY/WORKER_TOKEN or NODE_AGENT_SHARED_SECRET');
  if (secret?.trim() && secret.trim().toUpperCase() === PLACEHOLDER_SECRET.toUpperCase()) missing.push('node_shared_secret must not be REPLACE_ME (set real secret)');
  if (backend?.trim() && PLACEHOLDER_URL_PATTERNS.test(backend)) missing.push('server_base_url must be real URL (not placeholder)');
  return missing;
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

const _nodeId = strRequiredOptional('node_id', ['PC_CODE', 'PC_ID', 'DOAIME_PC_ID', 'NODE_ID']);
const _backendUrl = strRequiredOptional('server_base_url', ['API_BASE_URL', 'SERVER_URL', 'BACKEND_URL']);
const _sharedSecret = strRequiredOptional('node_shared_secret', ['WORKER_API_KEY', 'WORKER_TOKEN', 'DOAIME_WORKER_TOKEN', 'NODE_AGENT_SHARED_SECRET']);

export const config = {
  runnerVersion: RUNNER_VERSION,
  nodeId: _nodeId,
  vendorWsUrl: strOptional('vendor_ws_url', 'VENDOR_WS_URL') ?? 'ws://127.0.0.1:22222/',
  backendUrl: _backendUrl.replace(/\/$/, ''),
  sharedSecret: _sharedSecret,
  supabaseUrl: strOptional('supabase_url', 'SUPABASE_URL') ?? '',
  supabaseServiceRoleKey: strOptional('supabase_service_role_key', 'SUPABASE_SERVICE_ROLE_KEY') ?? '',
  adbPath: strOptional('adb_path', 'ADB_PATH') ?? DEFAULT_ADB_PATH,
  logFile: argvLogFile ?? strOptional('log_file', 'LOG_FILE'),
  pollIntervalMs: num('poll_interval_ms', 1500),
  maxJobs: num('max_jobs', 1),
  maxConcurrency,
  taskTimeoutMs: TASK_TIMEOUT_MS,
  uploadTimeoutMs: UPLOAD_TIMEOUT_MS,
  graceWaitMs: GRACE_WAIT_MS,
} as const;

export const MAX_CONCURRENCY_PER_NODE = maxConcurrency;
