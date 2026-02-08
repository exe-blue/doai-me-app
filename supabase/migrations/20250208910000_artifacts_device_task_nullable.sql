-- P0 callback: artifact_created can insert from node without device_task_id
alter table public.artifacts
  alter column device_task_id drop not null;
