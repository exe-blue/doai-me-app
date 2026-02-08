# API Routes + 다음에 할일 + PR 계획

> Next.js App Router. Node auth: Authorization Bearer NODE_AGENT_SHARED_SECRET. No service role in frontend. device_id=onlySerial, runtime_handle=serial. Timeout bounds enforced. failure_reason in device_tasks.

---

## 1. Routes (구현/정렬)

| Route | Method | 용도 | 상태 |
|-------|--------|------|------|
| app/api/runs/route.ts | POST | Create run (workflow_id, timeoutOverrides, bounds) | ✅ |
| app/api/runs/[runId]/route.ts | GET | Run summary (nodes, totals) | 정렬: [run_id]→[runId] |
| app/api/workflows/route.ts | GET | List workflows | ✅ |
| app/api/nodes/route.ts | GET | Node status list (heartbeats) | ✅ |
| app/api/nodes/callback/route.ts | POST | Node callback events (event_id idempotent) | ✅ |
| app/api/nodes/pull/route.ts | GET | Node pulls pending commands (run_start); hybrid: pull=run_start, callback=status | 신규 |

---

## 2. 구현 스텝

1. **app/api/nodes/pull/route.ts** — GET, verifyNodeAuth (Bearer), node_id query; return same payload as pending-runs (pending run_start list). Hybrid: 노드는 pull로 run_start 수신, callback으로 status 전송.
2. **app/api/runs/[runId]/route.ts** — [run_id] 폴더를 [runId]로 변경, params.runId 사용.
3. **node-agent** — poll URL을 /api/nodes/pull 로 변경 (또는 env로 선택).
4. **docs/API-Contracts-v1.md** — pull 엔드포인트 문서 추가.

---

## 3. 다음에 할일 (검증)

1. `supabase db push` 또는 `supabase migration up` — 스키마·시드 적용
2. `npm run build` — Next.js 빌드 성공
3. `cd node-agent && npm run build` — Node Agent 빌드 성공
4. (선택) POST /api/runs, GET /api/workflows, GET /api/runs/:runId, POST /api/nodes/callback, GET /api/nodes/pull 수동/통합 테스트

---

## 4. PR 계획 및 실행

1. 브랜치 생성: `feat/workflow-dsl-v1-api-routes` (또는 기존 통합 브랜치)
2. 커밋: API routes (runs, runs/[runId], workflows, nodes, callback, pull), node-agent pull URL, plan + docs
3. PR 생성: 제목/설명에 Workflow Recipe DSL v1, API Contracts v1, hybrid pull/callback 요약
4. (선택) CI 통과 확인

---

## 5. Constraints 체크

- [x] Node auth: Authorization Bearer NODE_AGENT_SHARED_SECRET
- [x] No service role key in frontend
- [x] device_id=onlySerial, runtime_handle=serial
- [x] Timeout override bounds (step 5s~10m, global 1m~30m)
- [x] device_tasks.failure_reason 저장
