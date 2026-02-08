-- P0 노드 pull: 락/경합/중복 실행 방지 — lease + FOR UPDATE SKIP LOCKED

-- 1. run_device_states에 lease 컬럼
alter table public.run_device_states
  add column if not exists lease_owner text;
alter table public.run_device_states
  add column if not exists lease_until timestamptz;
comment on column public.run_device_states.lease_owner is 'Node that holds the lease (node_id).';
comment on column public.run_device_states.lease_until is 'Lease TTL; after this time row can be re-assigned.';

-- 2. 단일 원자 트랜잭션: 후보 1건 선택 + lease 발급 (RPC)
create or replace function public.nodes_pull_assign(
  p_node_id text,
  p_online_window_sec int default 30,
  p_lease_sec int default 30
)
returns table (
  rds_id uuid,
  run_id uuid,
  device_index int,
  current_step_index int,
  rds_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rds_id uuid;
  v_run_id uuid;
  v_device_index int;
  v_current_step_index int;
  v_rds_status text;
begin
  -- Select one candidate and lock it (FOR UPDATE SKIP LOCKED)
  select rds.id, rds.run_id, rds.device_index, rds.current_step_index, rds.status
  into v_rds_id, v_run_id, v_device_index, v_current_step_index, v_rds_status
  from run_device_states rds
  join runs r on r.id = rds.run_id
  join devices d on d.index_no = rds.device_index
  where
    r.status in ('queued', 'running')
    and (rds.lease_until is null or rds.lease_until < now())
    and (d.last_seen_at is not null and d.last_seen_at >= now() - (p_online_window_sec || ' seconds')::interval)
    and rds.status in ('queued', 'running')
  order by r.created_at asc, rds.device_index asc
  limit 1
  for update of rds skip locked;

  if v_rds_id is null then
    return;
  end if;

  -- Issue lease
  update run_device_states
  set
    lease_owner = p_node_id,
    lease_until = now() + (p_lease_sec || ' seconds')::interval,
    updated_at = now()
  where id = v_rds_id;

  rds_id := v_rds_id;
  run_id := v_run_id;
  device_index := v_device_index;
  current_step_index := v_current_step_index;
  rds_status := v_rds_status;
  return next;
end;
$$;

comment on function public.nodes_pull_assign is 'P0: Atomically pick one run_device_state candidate and issue lease. Call from /api/nodes/pull.';

-- 3. run_steps: unique for (run_id, device_index, step_index) so pull can INSERT ... ON CONFLICT DO NOTHING
create unique index if not exists idx_run_steps_run_device_step
  on public.run_steps (run_id, device_index, step_index);
