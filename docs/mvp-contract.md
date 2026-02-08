# MVP 계약 (URL · 용어 · API 역할)

**혼선 방지용 단일 문서.** 1페이지 요약.

---

## URL (사용자 facing)

| URL | 용도 |
|-----|------|
| `/landing` | 랜딩 (루트 `/`는 여기로 리다이렉트) |
| `/commands` | 명령 라이브러리 (command_assets 목록·업로드·플레이북 저장·즉시 실행) |
| `/runs` | 실행 목록 |
| `/runs/{runId}` | 실행 모니터 (상태·히트맵·스텝·아티팩트) |
| `/devices` | 기기 Online/Offline 히트맵 |
| `/content` | 콘텐츠 |

**리다이렉트 (내부 명칭 유지):** `/command_catalogs`, `/dashboard/library` → `/commands`. `/dashboard/devices` → `/devices`. `/dashboard/runs` → `/runs`.

---

## 콜백 방식 아키텍처 (고정)

- **Web**: 등록·분배·상태만. 실행은 노드 러너가 담당.
- **최소 이벤트 (개념 ↔ 구현):**
  - **RUN_REQUEST (Web → Runner):** Runner가 `GET /api/nodes/pull`로 폴링하여 job 수신. (실제 전송은 Runner가 pull.)
  - **RUN_EVENT / DEVICE_SNAPSHOT (Runner → Web):** Runner가 `POST /api/nodes/callback`으로 task_started, run_step_update, task_finished, node_heartbeat 등 전송. event_id 멱등, lease_token 검증.

---

## 용어

| 용어 | 의미 |
|------|------|
| **Run** | 한 번의 “실행” 단위. playbook 또는 workflow 기준으로 생성. 상태: queued → running → completed / failed / stopped 등. |
| **Playbook** | 스텝 배열(command_asset + timeout 등). Run은 playbook_id 또는 workflow_id로 생성. |
| **Command asset** | adb 스크립트 등 실행 가능 에셋. `command_assets` 테이블, 라이브러리에서 업로드/목록. |
| **Node** | 실행 플레인(PC). node-runner가 pull/callback 하는 주체. |
| **Device** | 노드에 붙은 기기. `devices` 테이블, heartbeat/callback으로 last_seen_at 갱신. |
| **Lease** | pull 시 서버가 노드에 job을 “할당”하는 토큰. callback 시 lease_token 검증·멱등(event_id). |

---

## API 역할 (핵심만)

| API | 역할 |
|-----|------|
| `GET /api/library/list` | command_assets 목록 (type, folder, q 옵션). |
| `POST /api/library/upload` | 파일 업로드 → command-assets 스토리지 + command_assets 행. |
| `GET /api/playbooks` | playbooks 목록. `POST`로 플레이북 생성. |
| `GET /api/playbooks/:id` | 단일 플레이북 + 스텝. |
| `POST /api/runs` | Run 생성. body: `playbook_id` 또는 `workflow_id`, `params`, `target`(scope/node_ids). 응답: `run_id`. |
| `GET /api/runs` | Run 목록 (필터·폴링). |
| `GET /api/runs/:runId` | Run 모니터용 상세 (run, heatmap items, steps, artifacts). |
| `POST /api/runs/:runId/stop` | Run 중단 요청. |
| `GET /api/nodes/pull?node_id=...` | **노드 전용.** Header `X-Node-Auth` 또는 `Authorization: Bearer <NODE_AGENT_SHARED_SECRET>`. 서버: lease 할당 후 job 1건 반환 (노드 동시 1개 고정). |
| `POST /api/nodes/callback` | **노드 전용.** task_started / run_step_update / task_finished 등. event_id 멱등, lease_token 검증. |
| `GET /api/nodes/status` | 디바이스/노드 상태 (devices 페이지 폴링). |

---

## E2E 수용 테스트

- **프론트엔드 E2E:** `scripts/e2e-mvp-acceptance.mjs`
  - 실행: `BASE_URL=http://localhost:3000 npm run e2e:acceptance` (앱 서버 기동 후)
  - 출력: `E2E_REPORT`(기본 `./e2e-report.json`) + 실패 시 `E2E_SCREENSHOTS` 디렉터리에 스크린샷.
  - 리포트 필드: `steps`(commands, runCreate, runMonitor, devices), `firstConsoleError`, `failedApis`, `stateTransitions`, `screenshotOnFailure`, `passed`.
- **서버 단위 (옵션):** `scripts/e2e-mock-node-server.mjs` — mock node로 pull/callback 호출, lease·멱등 확인.
  - 실행: `BASE_URL=http://localhost:3000 NODE_AGENT_SHARED_SECRET=your-secret node scripts/e2e-mock-node-server.mjs`

### 결과 샘플 (e2e-report.json)

```json
{
  "baseUrl": "http://localhost:3000",
  "passed": true,
  "steps": {
    "commands": { "visited": true, "adbCommandExists": true },
    "runCreate": { "created": true, "run_id": "uuid" },
    "runMonitor": { "visited": true, "stateTransitions": [{"status": "queued"}, {"status": "running"}, {"status": "completed"}], "finalStatus": "completed" },
    "devices": { "visited": true, "hasOnlineOfflineDisplay": true }
  },
  "firstConsoleError": null,
  "failedApis": [],
  "screenshotOnFailure": null
}
```
