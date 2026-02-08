-- Prometheus: Workflow Recipe + Run tracking
-- workflows: 명령 레시피 저장/재사용
-- runs.workflow_id: 어떤 workflow로 실행했는지 추적

-- 1. workflows: 명령 레시피
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null unique,
  name text not null,
  version text not null default '1.0.0',
  description text,
  definition_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflows_workflow_id on public.workflows (workflow_id);

-- 2. runs에 workflow_id 추가 (어떤 workflow로 실행했는지 추적)
alter table public.runs
  add column if not exists workflow_id uuid references public.workflows(id);

alter table public.runs
  add column if not exists timeout_overrides jsonb;

alter table public.runs
  add column if not exists global_timeout_ms integer;

create index if not exists idx_runs_workflow_id on public.runs (workflow_id);

-- 3. device_tasks에 requires_manual_accessibility (접근성 수동 필요 시)
alter table public.device_tasks
  add column if not exists requires_manual_accessibility boolean default false;

-- RLS
alter table public.workflows enable row level security;
