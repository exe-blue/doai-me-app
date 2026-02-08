-- MVP Schema: videos, runs, device_tasks, artifacts
-- Storage bucket: artifacts
-- Path convention: videos/{youtubeVideoId}/{deviceSerial}/{timestamp}.png

-- 1. Storage bucket: artifacts (private; use service_role for uploads)
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do nothing;

-- 2. videos: unique youtubeVideoId per video
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  channel_id text,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists idx_videos_youtube_video_id on public.videos (youtube_video_id);

-- run/device_task status: single definition to satisfy literal duplication rule (Sonar S1192)
create domain public.run_status_text as text
  check (value in ('pending', 'running', 'completed', 'failed'))
  default 'pending';

-- 3. runs: one per video playback job
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  status public.run_status_text not null,
  started_at timestamptz,
  finished_at timestamptz,
  node_agent_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_video_id on public.runs (video_id);
create index if not exists idx_runs_status on public.runs (status);

-- 4. device_tasks: one per device per run
create table if not exists public.device_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  device_serial text not null,
  status public.run_status_text not null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_tasks_run_id on public.device_tasks (run_id);
create index if not exists idx_device_tasks_device_serial on public.device_tasks (device_serial);

-- 5. artifacts: screenshots stored in artifacts bucket
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  device_task_id uuid not null references public.device_tasks(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_artifacts_device_task_id on public.artifacts (device_task_id);

-- RLS: enabled; service_role bypasses RLS. No permissive policies = anon/auth get no access.
alter table public.videos enable row level security;
alter table public.runs enable row level security;
alter table public.device_tasks enable row level security;
alter table public.artifacts enable row level security;
