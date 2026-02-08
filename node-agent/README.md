# DoAi.Me Node Agent (Windows runner)

Poll → job → ADB/screenshot → upload → callback. 1–2s poll; callbacks include `event_id` (idempotent) and `lease_token`. Heartbeat includes `runner_version`.

## 실행

**옵션 A — 환경변수**

```bash
cd node-agent
cp .env.example .env
# .env에 NODE_ID, BACKEND_URL, NODE_AGENT_SHARED_SECRET, SUPABASE_*, VENDOR_WS_URL 설정
npm install
npm run build
node dist-bundle/index.cjs
```

**옵션 B — config 파일 (Windows 서비스/EXE 권장)**

```bash
node dist-bundle/index.cjs --config "C:\ProgramData\doai\node-runner\config.json"
# 또는
node-runner.exe --config "C:\ProgramData\doai\node-runner\config.json"
```

`--help` / `-h`: CLI 도움말 (--config 설명 포함).

개발 시: `npm run dev` (tsx로 실행).

## E2E 1사이클 확인

1. 서버에서 Run 생성(playbook + device가 run_device_states에 있는 run).
2. 노드 기동 후 1~2초 폴링으로 pull → job 수신 → (decision executed 시) ADB 실행 → 스크린샷 → Storage 업로드 → task_started / run_step_update / artifact_created / task_finished 콜백 전송.
3. `/runs/[runId]` 모니터에서 해당 디바이스 히트맵·로그·스크린샷 확인.

`decision === 'skipped'`면 실행 없이 run_step_update(skipped)만 전송. 모든 콜백에 `lease_token`·`event_id` 포함(재시도 시 동일 event_id로 멱등).
