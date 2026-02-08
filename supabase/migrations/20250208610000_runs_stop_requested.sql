-- Run stop request: Node polls and stops when set
alter table public.runs
  add column if not exists stop_requested_at timestamptz;

comment on column public.runs.stop_requested_at is 'When set, Node should stop the run.';
