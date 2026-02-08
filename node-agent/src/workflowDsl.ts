/**
 * Workflow DSL v1 — Parser + types
 * step.kind: adb | vendor | upload | js (optional)
 * Common: timeoutMs, onFailure (stop | continue | retry), retryCount
 */

const STEP_TIMEOUT_MIN_MS = 5_000;
const STEP_TIMEOUT_MAX_MS = 600_000;

export type OnFailure = 'stop' | 'continue' | 'retry';

export type StepBase = {
  id: string;
  timeoutMs?: number;
  onFailure?: OnFailure;
  retryCount?: number;
};

export type StepAdb = StepBase & {
  kind: 'adb';
  command: string;
};

export type StepVendor = StepBase & {
  kind: 'vendor';
  action: 'list' | 'screen' | 'login';
  params?: Record<string, unknown>;
};

export type StepUpload = StepBase & {
  kind: 'upload';
  source: string;
};

export type StepJs = StepBase & {
  kind: 'js';
  script?: string;
  params?: Record<string, unknown>;
};

export type Step = StepAdb | StepVendor | StepUpload | StepJs;

export type WorkflowDefinition = {
  steps: Step[];
  defaultStepTimeoutMs?: number;
  defaultOnFailure?: OnFailure;
};

export type NormalizedStep = Step & {
  timeoutMs: number;
  onFailure: OnFailure;
  retryCount: number;
};

function clampTimeout(ms: number): number {
  return Math.max(STEP_TIMEOUT_MIN_MS, Math.min(STEP_TIMEOUT_MAX_MS, ms));
}

function parseStep(raw: unknown): Step | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind as string;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id || !kind) return null;

  const base: StepBase = {
    id,
    timeoutMs: typeof o.timeoutMs === 'number' ? o.timeoutMs : undefined,
    onFailure: ['stop', 'continue', 'retry'].includes(o.onFailure as string) ? (o.onFailure as OnFailure) : undefined,
    retryCount: typeof o.retryCount === 'number' ? o.retryCount : undefined,
  };

  if (kind === 'adb') {
    const command = typeof o.command === 'string' ? o.command : '';
    return { ...base, kind: 'adb', command };
  }
  if (kind === 'vendor') {
    const action = (o.action === 'list' || o.action === 'screen' || o.action === 'login') ? o.action : 'list';
    return { ...base, kind: 'vendor', action, params: typeof o.params === 'object' && o.params ? (o.params as Record<string, unknown>) : undefined };
  }
  if (kind === 'upload') {
    const source = typeof o.source === 'string' ? o.source : 'screenshot';
    return { ...base, kind: 'upload', source };
  }
  if (kind === 'js') {
    return {
      ...base,
      kind: 'js',
      script: typeof o.script === 'string' ? o.script : undefined,
      params: typeof o.params === 'object' && o.params ? (o.params as Record<string, unknown>) : undefined,
    };
  }
  return null;
}

/**
 * Parse definition_json and apply timeout overrides by step id.
 * Returns normalized steps (timeoutMs, onFailure, retryCount filled).
 */
export function parseWorkflowDefinition(
  definition: unknown,
  timeoutOverrides?: Record<string, number>
): NormalizedStep[] {
  if (!definition || typeof definition !== 'object') return [];
  const def = definition as Record<string, unknown>;
  const stepsRaw = Array.isArray(def.steps) ? def.steps : [];
  const defaultTimeout = typeof def.defaultStepTimeoutMs === 'number'
    ? clampTimeout(def.defaultStepTimeoutMs)
    : 30_000;
  const defaultOnFailure: OnFailure = ['stop', 'continue', 'retry'].includes(def.defaultOnFailure as string)
    ? (def.defaultOnFailure as OnFailure)
    : 'stop';

  const normalized: NormalizedStep[] = [];
  for (const raw of stepsRaw) {
    const step = parseStep(raw);
    if (!step) continue;
    const overrideMs = timeoutOverrides?.[step.id];
    const timeoutMs = typeof overrideMs === 'number' ? clampTimeout(overrideMs) : clampTimeout(step.timeoutMs ?? defaultTimeout);
    const onFailure = step.onFailure ?? defaultOnFailure;
    const retryCount = typeof step.retryCount === 'number' && step.retryCount >= 0 ? step.retryCount : 0;
    normalized.push({ ...step, timeoutMs, onFailure, retryCount });
  }
  return normalized;
}
