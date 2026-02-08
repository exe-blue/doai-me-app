-- Dashboard MVP: channels (YouTube) + contents (videos). Content status = new | done.

-- 1. channels (YouTube provider only for MVP)
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'youtube' check (provider = 'youtube'),
  channel_id text not null,
  title text,
  thumbnail_url text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, channel_id)
);

create index if not exists idx_channels_provider_channel_id on public.channels (provider, channel_id);

-- 2. contents (videos from channels; status new = no succeeded run, done = has succeeded run)
create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'youtube' check (provider = 'youtube'),
  content_id text not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text,
  published_at timestamptz,
  thumbnail_url text,
  status text not null default 'new' check (status in ('new', 'done')),
  last_seen_at timestamptz not null default now(),
  run_id uuid references public.runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(provider, content_id)
);

create index if not exists idx_contents_channel_id on public.contents (channel_id);
create index if not exists idx_contents_published_at on public.contents (published_at);
create index if not exists idx_contents_status on public.contents (status);
create index if not exists idx_contents_run_id on public.contents (run_id);

comment on column public.contents.status is 'new = no run or run not succeeded; done = run succeeded.';
comment on column public.contents.run_id is 'Run created from this content (for done status).';

-- RLS
alter table public.channels enable row level security;
alter table public.contents enable row level security;
