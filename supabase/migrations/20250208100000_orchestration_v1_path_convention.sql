-- DoAi.Me MVP Orchestration v1: node_id on device_tasks, path convention
-- Path: {youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png

-- Add node_id to device_tasks (which node handled this device)
alter table public.device_tasks
  add column if not exists node_id text;

create index if not exists idx_device_tasks_node_id on public.device_tasks (node_id);

-- Add node_id to runs for broadcast tracking (optional; device_tasks is source of truth per-device)
-- runs.node_agent_id remains for backward compat; consider nodes table for 4-5 nodes registry
comment on column public.device_tasks.node_id is 'Node Agent ID that executed this device task';
