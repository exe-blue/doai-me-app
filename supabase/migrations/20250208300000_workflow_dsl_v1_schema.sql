-- Workflow Recipe DSL v1: device_tasks failure_reason/error_message/device_id/runtime_handle;
-- runs trigger/scope/youtube_video_id; artifacts public_url; runs status extended; callback_events idempotency

-- 1. runs: extend status, add trigger, scope, youtube_video_id (denormalized for API)
alter table public.runs
  add column if not exists trigger text default 'manual';
alter table public.runs
  add column if not exists scope text default 'ALL';
alter table public.runs
  add column if not exists youtube_video_id text;

-- video_id nullable for manual runs without a video
alter table public.runs
  alter column video_id drop not null;

-- Drop existing status check and re-add with new values
alter table public.runs drop constraint if exists runs_status_check;
alter table public.runs
  add constraint runs_status_check check (status in (
    'pending', 'queued', 'running', 'completed', 'completed_with_errors', 'failed'
  ));

-- 2. device_tasks: failure_reason, error_message, device_id, runtime_handle
alter table public.device_tasks
  add column if not exists failure_reason text;
alter table public.device_tasks
  add column if not exists error_message text;
alter table public.device_tasks
  add column if not exists device_id text;
alter table public.device_tasks
  add column if not exists runtime_handle text;

comment on column public.device_tasks.device_id is 'onlySerial: immutable device identity (queue/DB key)';
comment on column public.device_tasks.runtime_handle is 'Vendor list serial (ADB -s target)';

-- Backfill device_id from device_serial where null
update public.device_tasks set device_id = device_serial where device_id is null and device_serial is not null;

-- 3. artifacts: public_url
alter table public.artifacts
  add column if not exists public_url text;
alter table public.artifacts
  add column if not exists run_id uuid references public.runs(id) on delete set null;
alter table public.artifacts
  add column if not exists node_id text;
alter table public.artifacts
  add column if not exists device_id text;

-- 4. callback_events: idempotency for node callbacks
create table if not exists public.callback_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);

-- 5. node_heartbeats: for GET /api/nodes (node status dashboard)
create table if not exists public.node_heartbeats (
  node_id text not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (node_id)
);

create index if not exists idx_device_tasks_device_id on public.device_tasks (device_id);
alter table public.node_heartbeats enable row level security;
