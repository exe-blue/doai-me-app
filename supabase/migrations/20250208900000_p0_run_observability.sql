-- P0 골격: run 관측(히트맵/로그) + devices 인덱스
-- 기존 테이블 유지, run_device_states / run_steps 추가, devices/runs/artifacts 보강

-- 1. devices: 타일 인덱스(1..100) + runtime_handle, label
alter table public.devices
  add column if not exists index_no int unique;
alter table public.devices
  add column if not exists runtime_handle text;
alter table public.devices
  add column if not exists label text;
comment on column public.devices.index_no is 'Heatmap tile index (1..100). UI uses this for position.';
comment on column public.devices.runtime_handle is 'ADB -s target (e.g. serial).';

-- 2. runs: target(scope/device_indexes), last_error_message
alter table public.runs
  add column if not exists target jsonb default '{}'::jsonb;
alter table public.runs
  add column if not exists last_error_message text;
comment on column public.runs.target is '{ scope: "ALL" | "SELECTED", device_indexes?: number[] }';

-- 3. run_device_states: run별 디바이스(인덱스) 상태 — 히트맵/진행률
create table if not exists public.run_device_states (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  device_index int not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'stopped', 'succeeded', 'failed')),
  current_step_index int default 0,
  last_seen timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, device_index)
);
create index if not exists idx_run_device_states_run on public.run_device_states(run_id);
comment on table public.run_device_states is 'Per-run per-device-index state for heatmap. Offline = skipped_offline not stored here.';

-- 4. run_steps: step 단위 로그(관측)
create table if not exists public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  device_index int not null,
  step_index int not null,
  step_id text not null,
  step_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'skipped', 'succeeded', 'failed')),
  probability double precision default 1.0,
  decision text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_run_steps_run_dev on public.run_steps(run_id, device_index);
create index if not exists idx_run_steps_run_step on public.run_steps(run_id, step_index);
comment on column public.run_steps.decision is 'executed | skipped';

-- 5. artifacts: device_index, kind (screenshot|log)
alter table public.artifacts
  add column if not exists device_index int;
alter table public.artifacts
  add column if not exists kind text;
comment on column public.artifacts.kind is 'screenshot | log';

alter table public.run_device_states enable row level security;
alter table public.run_steps enable row level security;
