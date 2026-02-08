-- Command Library MVP: ADB/JS/기타 스니펫을 라이브러리로 관리, workflow step에서 ref로 참조
-- See docs/Command-Library-MVP-Design.md

create type public.command_asset_kind as enum ('adb', 'js', 'vendor', 'assert');

create table if not exists public.command_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.command_asset_kind not null,
  title text not null,
  description text,
  storage_path text,
  inline_content text,
  default_timeout_ms integer,
  folder text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint command_assets_content check (
    (storage_path is not null and storage_path <> '') or
    (inline_content is not null and inline_content <> '')
  )
);

create index if not exists idx_command_assets_kind on public.command_assets (kind);
create index if not exists idx_command_assets_folder on public.command_assets (folder);
create index if not exists idx_command_assets_updated_at on public.command_assets (updated_at);

comment on table public.command_assets is 'Command/snippet library: ADB one-liners, JS scripts. Referenced by workflow steps via ref (asset id or slug).';
comment on column public.command_assets.storage_path is 'Storage path when content is file (e.g. artifacts or dedicated bucket).';
comment on column public.command_assets.inline_content is 'Inline text for short commands (e.g. adb one-liner).';
comment on column public.command_assets.folder is 'UI folder label (not filesystem).';

alter table public.command_assets enable row level security;
