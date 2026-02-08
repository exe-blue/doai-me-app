# MVP: adb 명령 1개 실행 플로우

**목표**: 웹에서 Run 생성 → 노드 pull → adb 1개 실행 → callback 완료까지 단일 플로우.

## 흐름

1. **웹**: Run 생성  
   - `POST /api/runs` body: `{ "playbook_id": "<mvp_one_adb uuid>", "target": { "scope": "ALL" } }`  
   - 또는 `target: { "node_ids": ["PC-01"] }`  
   - 서버: `runs` 1건 insert + 대상 디바이스마다 `run_device_states` insert (status=queued, current_step_index=0).

2. **노드**: Poll  
   - `GET /api/nodes/pull?node_id=PC-01` (Header: `X-Node-Auth` 또는 `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`).  
   - 서버: `nodes_pull_assign` RPC로 후보 1건 할당(lease) → playbook_steps + command_assets 조회 → job 1건 반환 (`step_command`, `runtime_handle` 등).

3. **노드**: 실행  
   - `jobRunner.runJob`: `step_type === 'adb'` 이고 `step_command` 있으면 `runAdbScript(runtime_handle, step_command, ...)` 실행.

4. **노드**: Callback  
   - `POST /api/nodes/callback`: `task_started` → `run_step_update` → `task_finished` (event_id idempotent, lease_token 검증).

## 시드 데이터 (마이그레이션 `20250208950000_mvp_one_adb_seed.sql`)

- **command_assets**: `mvp_echo_hello` (kind=adb, inline_content=`echo hello`).
- **playbooks**: `mvp_one_adb` (이름으로 조회 가능).
- **playbook_steps**: 1단계, 위 asset 참조, probability=1.
- **devices**: `MVP-DEV-01`, node_id=PC-01, index_no=1, runtime_handle=MVP-DEV-01.

## Run 생성 예시

```bash
# playbook id 조회 (Supabase playbooks 테이블에서 name='mvp_one_adb' 인 row의 id)
curl -X POST https://<your-app>.vercel.app/api/runs \
  -H "Content-Type: application/json" \
  -d '{"playbook_id": "<playbook-uuid>", "target": { "scope": "ALL" }}'
# => { "run_id": "..." }
```

노드가 동작 중이면 pull 시 위 run에 대한 job 1건을 받고, adb 실행 후 callback으로 완료 보고.

## 전제

- `NODE_AGENT_SHARED_SECRET` 동일하게 서버·노드에 설정.
- 노드: `config.json` 또는 env에 `node_id=PC-01`, `server_base_url`, `node_shared_secret`, `adb_path`.
- 디바이스가 heartbeat/callback으로 `last_seen_at`이 갱신되어 있어야 pull 할당 대상이 됨 (시드 디바이스는 마이그레이션에서 `last_seen_at=now()` 설정).
