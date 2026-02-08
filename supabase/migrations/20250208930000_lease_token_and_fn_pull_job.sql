-- lease_token 추가 + fn_pull_job() 테스트용 함수
-- 계약: jobs[0].lease.token 필수, callback에서 lease_token 검증

-- 1. run_device_states.lease_token
alter table public.run_device_states
  add column if not exists lease_token uuid;
comment on column public.run_device_states.lease_token is 'Unique token per lease; callback must send this to apply state updates.';

-- 2. nodes_pull_assign: lease_token 발급 및 반환
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
  rds_status text,
  lease_token uuid
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
  v_lease_token uuid;
begin
  v_lease_token := gen_random_uuid();

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

  update run_device_states
  set
    lease_owner = p_node_id,
    lease_until = now() + (p_lease_sec || ' seconds')::interval,
    lease_token = v_lease_token,
    updated_at = now()
  where id = v_rds_id;

  rds_id := v_rds_id;
  run_id := v_run_id;
  device_index := v_device_index;
  current_step_index := v_current_step_index;
  rds_status := v_rds_status;
  lease_token := v_lease_token;
  return next;
end;
$$;

-- 3. fn_pull_job: 테스트/검증용 — 할당 결과를 jsonb로 반환 (실제 job payload는 앱에서 조립)
create or replace function public.fn_pull_job(
  p_node_id text,
  p_max_jobs int default 1,
  p_online_window_sec int default 30,
  p_lease_sec int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  out_job jsonb;
begin
  select rds_id, run_id, device_index, current_step_index, rds_status, lease_token
  into rec
  from public.nodes_pull_assign(p_node_id, p_online_window_sec, p_lease_sec)
  limit 1;

  if rec.rds_id is null then
    return jsonb_build_object('assigned', false, 'jobs', '[]'::jsonb);
  end if;

  out_job := jsonb_build_object(
    'assigned', true,
    'rds_id', rec.rds_id,
    'run_id', rec.run_id,
    'device_index', rec.device_index,
    'current_step_index', rec.current_step_index,
    'rds_status', rec.rds_status,
    'lease_token', rec.lease_token,
    'lease', jsonb_build_object('token', rec.lease_token)
  );
  return jsonb_build_object('assigned', true, 'jobs', jsonb_build_array(out_job));
end;
$$;

comment on function public.fn_pull_job is 'Test/verification: returns assign result as JSON. Full job payload is built in app. jobs[0].lease.token is required in API response.';

-- 테스트 쿼리 예시 (할당 가능한 후보가 있을 때 job json 반환):
-- select fn_pull_job('PC-01', 1, 30, 30);
