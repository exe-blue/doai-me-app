-- FRD DoAi.Me MVP v1: Playbooks, devices, nodes, run_step_results, scan_jobs
-- Command Library + Status Dashboard + Run Monitor. See docs/FRD-DoAi-Me-MVP-v1 (or FRD in repo).

-- 1. Storage bucket: command-assets (uploaded scripts)
insert into storage.buckets (id, name, public)
values ('command-assets', 'command-assets', false)
on conflict (id) do nothing;

-- 2. command_assets: extend with asset_type (FRD: adb_script, js, json, text, vendor_action)
alter table public.command_assets
  add column if not exists asset_type text default 'adb_script';

alter table public.command_assets
  drop constraint if exists command_assets_asset_type_check;

alter table public.command_assets
  add constraint command_assets_asset_type_check check (
    asset_type in ('adb_script', 'js', 'json', 'text', 'vendor_action')
  );

comment on column public.command_assets.asset_type is 'FRD type: adb_script, js, json, text, vendor_action';

-- 3. playbooks: 사용자 정의 명령 조합
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. playbook_steps: 순서 + timeout/retry/onFailure/probability/params
create table if not exists public.playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  command_asset_id uuid not null references public.command_assets(id) on delete restrict,
  sort_order int not null default 0,
  timeout_ms int,
  on_failure text default 'stop' check (on_failure in ('stop', 'continue', 'retry')),
  retry_count int default 0,
  probability numeric(3,2) default 1.0 check (probability >= 0 and probability <= 1),
  params jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_playbook_steps_playbook_id on public.playbook_steps (playbook_id);

comment on column public.playbook_steps.probability is '0.0~1.0. Step runs only if random(seed(run_id,device_id,step_id)) < probability. Reproducible.';

-- 5. devices: 등록된 기기 (Status Dashboard Online/Offline)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  node_id text,
  last_seen_at timestamptz,
  last_error_message text,
  last_screenshot_artifact_id uuid references public.artifacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id)
);

create index if not exists idx_devices_node_id on public.devices (node_id);
create index if not exists idx_devices_last_seen on public.devices (last_seen_at);

comment on column public.devices.device_id is 'Immutable device identity (e.g. serial).';
comment on column public.devices.last_seen_at is 'Used to derive Online (within N sec) vs Offline.';

-- 6. nodes: 노드 등록 (node_heartbeats와 병행 사용 가능)
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  node_id text not null unique,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nodes_node_id on public.nodes (node_id);

-- 7. runs: playbook_id 추가 (workflow_id 또는 playbook_id 중 하나 사용)
alter table public.runs
  add column if not exists playbook_id uuid references public.playbooks(id) on delete set null;

comment on column public.runs.playbook_id is 'When set, run executes playbook steps; else workflow_id.';

-- 8. run_step_results: 디바이스별 스텝 진행/로그/스크린샷 (Run Monitor)
create table if not exists public.run_step_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  device_task_id uuid references public.device_tasks(id) on delete cascade,
  step_id text not null,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'skipped', 'running', 'completed', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  log_snippet text,
  artifact_id uuid references public.artifacts(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_run_step_results_run_id on public.run_step_results (run_id);
create index if not exists idx_run_step_results_device_task on public.run_step_results (device_task_id);

comment on column public.run_step_results.step_id is 'Step identifier from playbook/workflow.';
comment on column public.run_step_results.status is 'skipped = probability did not pass.';

-- 9. scan_jobs: 스캔 요청 (FR-SD-5, FR-SD-6)
create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  ip_range text not null,
  ports text[] default array['5555'],
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  log_snippet text,
  created_at timestamptz not null default now()
);

-- 10. scan_results: 스캔으로 발견된 기기 (FR-SD-7)
create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references public.scan_jobs(id) on delete cascade,
  ip text,
  port int,
  device_serial text,
  node_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_results_scan_job_id on public.scan_results (scan_job_id);

-- RLS
alter table public.playbooks enable row level security;
alter table public.playbook_steps enable row level security;
alter table public.devices enable row level security;
alter table public.nodes enable row level security;
alter table public.run_step_results enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.scan_results enable row level security;
