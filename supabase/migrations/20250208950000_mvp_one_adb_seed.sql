-- MVP: 단일 adb 명령 1개 실행 플로우 — Playbook 1개 + command_asset 1개 + 디바이스 1개 시드
-- Run 생성 → 노드 pull → adb 실행 → callback 완료까지 사용

-- 1. Command asset: adb 한 줄 (echo로 동작 확인용)
insert into public.command_assets (kind, title, description, folder, inline_content, default_timeout_ms)
select
  'adb'::public.command_asset_kind,
  'mvp_echo_hello',
  'MVP: 단일 adb 명령. echo hello',
  'mvp',
  'echo hello',
  10000
where not exists (select 1 from public.command_assets where title = 'mvp_echo_hello' and folder = 'mvp');

-- 2. Playbook: 1단계만 (위 asset 참조)
insert into public.playbooks (id, name, description)
select
  gen_random_uuid(),
  'mvp_one_adb',
  'MVP: adb 명령 1개 실행'
where not exists (select 1 from public.playbooks where name = 'mvp_one_adb');

insert into public.playbook_steps (playbook_id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability)
select
  p.id,
  c.id,
  0,
  10000,
  'stop',
  0,
  1.0
from public.playbooks p
cross join public.command_assets c
where p.name = 'mvp_one_adb' and c.title = 'mvp_echo_hello' and c.folder = 'mvp'
  and not exists (
    select 1 from public.playbook_steps ps
    where ps.playbook_id = p.id and ps.sort_order = 0
  );

-- 3. Device 1개 시드 (노드 PC-01, index_no=1). heartbeat 시 last_seen_at 갱신됨
insert into public.devices (device_id, node_id, index_no, runtime_handle, last_seen_at)
select
  'MVP-DEV-01',
  'PC-01',
  1,
  'MVP-DEV-01',
  now()
where not exists (select 1 from public.devices where device_id = 'MVP-DEV-01')
on conflict (device_id) do update set
  node_id = excluded.node_id,
  index_no = excluded.index_no,
  runtime_handle = excluded.runtime_handle,
  last_seen_at = greatest(devices.last_seen_at, excluded.last_seen_at);
