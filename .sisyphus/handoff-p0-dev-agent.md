# 개발 에이전트 핸드오프 프롬프트 (P0 구현 우선)

아래 내용을 그대로 복붙해서 개발 에이전트 핸드오프 프롬프트로 쓰면 됨.

---

## 목표

OTG 100대 운영을 전제로, 멈추지 않는 실행 + 관측 가능(로그/스크린샷) + Online/Offline 히트맵 중심 UI를 P0로 완성한다.
추가 기능(콘텐츠/온보딩/유튜브)은 P1로 미룬다.

### 운영 기본값(하드코딩 OK)

- ONLINE_WINDOW_SEC = 30
- DEVICE_GRACE_WAIT_MS = 15000
- RUN_CONCURRENCY = 1 (디바이스 1대씩 순차)
- 정책:
  - Offline(online=false) 디바이스는 실행 대상에서 제외하고 skipped_offline으로 기록
  - 실행 중 무응답/에러 시 15초 grace wait 후 해당 디바이스는 실패 처리하고 다음 디바이스 진행 (전체 run이 멈추면 안 됨)

---

## P0 범위 (이번 스프린트 구현)

### 1) 라우트/메뉴(한국어)

- 대시보드 /
- 명령 /commands
- 기기 /devices
- 실행 /runs
- 실행 상세 /runs/[runId]

(콘텐츠 /content는 P1)

기존 /dashboard/*는 새 라우트로 정리. /dashboard가 있으면 / 또는 /devices로 redirect.

---

### 2) DB 스키마(P0 최소)

Supabase Postgres migrate로 아래 테이블만 우선 생성(필드 최소화).

**nodes**

- id (text, pk) 예: PC-01
- name (text)
- last_seen (timestamptz)
- last_error_message (text)
- timestamps

**devices**

- id (uuid, pk)
- index_no (int, unique) 히트맵 타일 인덱스
- device_id (text, unique, nullable) onlySerial
- runtime_handle (text, nullable) adb -s 대상
- node_id (fk nodes.id, nullable)
- label (text, nullable)
- last_seen (timestamptz)
- last_error_message (text)
- timestamps

**command_assets**

- id (uuid)
- type enum('adb_script','js','json','vendor_action','text')
- title
- folder
- storage_path (supabase storage: command-assets)
- default_timeout_ms
- timestamps

**playbooks**

- id
- title
- steps (jsonb) (순서/확률/timeout/retry/onFailure/params 포함)
- timestamps

**runs**

- id
- title
- mode text default 'playbook' ('playbook'|'workflow')
- playbook_id fk
- workflow_id text (seed "demo_20steps_v1" 지원 유지)
- params jsonb
- target jsonb (예: {scope:"ALL"} or {device_indexes:[…]})
- status enum('queued','running','stopped','succeeded','failed')
- created_at, started_at, finished_at
- last_error_message

**run_device_states** (히트맵용 요약)

- run_id fk
- device_index int
- status run_status
- current_step_index int
- last_seen
- last_error_message
- unique(run_id, device_index)

**run_steps** (관측)

- run_id fk
- device_index
- step_index
- step_id
- step_type
- status enum('queued','running','skipped','succeeded','failed')
- probability float default 1.0
- decision text ('executed'|'skipped')
- started_at, finished_at
- error_message

**artifacts**

- run_id fk
- device_index
- kind text ('screenshot'|'log')
- storage_path (supabase storage: artifacts)
- created_at

(선택) scan_jobs는 P0 후반에 추가해도 됨.

---

### 3) 공통 ViewModel(버그 예방 핵심)

UI는 API raw를 직접 쓰지 말고, 페이지 레벨에서 아래 형태로 변환해 Heatmap에 공급할 것.

```ts
type HeatmapItem = {
  index: number;
  online: boolean;
  activity?: "idle"|"running"|"waiting"|"error"|"done";
  progress?: { current:number; total:number };
  last_seen?: string;
  last_error_message?: string;
};
```

---

### 4) API(P0 폴링 기반)

#### 4.1 Playbook

- POST /api/playbooks → {id}
- GET /api/playbooks/:id

#### 4.2 Runs

- POST /api/runs (mode: playbook/workflow)
- GET /api/runs (리스트)
- GET /api/runs/:runId (모니터: heatmap + selected + logs_tail + last_artifacts)
- POST /api/runs/:runId/stop

#### 4.3 Devices/Nodes

- GET /api/nodes/status (devices 히트맵; 3초 폴링)
- (선택) GET /api/devices/:index (상세 drawer용)
- (P0 후반) POST /api/nodes/scan (스캔 시작)

#### 4.4 Node Callback (중요)

- POST /api/nodes/callback
- headers: X-Node-Auth: NODE_SHARED_SECRET
- body: { event_id, type, node_id, payload }
- type: device_heartbeat | run_step_update | artifact_created | scan_progress
- 멱등성(event_id) 처리(중복 무시)

P0에서는 WebSocket/SSE 사용하지 말고 폴링으로. Realtime 전환은 P2.

---

### 5) UI 페이지별 요구사항(P0)

**/ 대시보드**

- GET /api/dashboard?window=24h (15~30초 폴링)
- KPI 6개 + 시간대별 실행량(막대) + Offline 추이(선/막대) + To-do + 미니 히트맵(online/offline)

**/devices**

- 히트맵(10x10 기본) + 필터(All/Online/Offline) + 검색(index)
- 타일 클릭 → 우측 drawer(최소: last_seen, last_error_message, 마지막 스샷 있으면 표시)

**/runs, /runs/[runId]**

- runs 리스트: 상태/카운트 표기, 클릭 시 상세
- run 상세: 히트맵(online/offline + activity 테두리), 우측 drawer에서 현재 step/로그 50줄/마지막 스샷
- 무응답 처리: activity=waiting 표기 가능(서버가 내려주면 UI 반영)

**/commands**

- 중앙 테이블(명령 리스트) + 우측 builder(선택 step 순서/확률/timeout/retry/onFailure)
- "저장(playbook)" + "즉시 실행(run 생성 후 /runs/[runId] 이동)"
- command_assets 업로드 UI는 P0 말미 또는 P1 초입에 붙여도 됨(우선 DB/실행 루프가 먼저)

---

### 6) 로더/테마(정리 작업, P0 포함)

- 전역 로더 규칙:
  - 300ms 이상 지연 시 로더
  - 3초 이상 "연결 확인 중…" 문구
- 컴포넌트 최소 세트:
  - DeviceHeatmap, DataTable, Drawer, KpiCard, ChartCard, Loader, Skeleton, Toast
- 상태 색/테두리 규칙:
  - 배경: online/offline
  - 테두리: running/waiting/error/done/idle

---

### 7) 크론/잡(P0에서는 제외)

P0는 실행/관측/운영 안정화가 목표.
Vercel Cron(유튜브 동기화)은 P1에서 추가.

---

## 산출물(DoD)

1. migrate 완료 후 테이블 생성 확인
2. /devices 히트맵이 online/offline로 정상 갱신(폴링)
3. /commands에서 playbook 생성 → run 생성 → /runs/[runId]에서 step/log/스크린샷 관측
4. Offline 디바이스는 실행 스킵되고, 에러/무응답은 grace wait 후 다음 디바이스로 진행(전체 run 멈추지 않음)
5. 전역 로더/토스트/스켈레톤 동작

---

## 환경변수(Vercel)

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (서버 전용)
- SUPABASE_ANON_KEY (필요 시)
- SUPABASE_STORAGE_BUCKET_COMMAND_ASSETS=command-assets
- SUPABASE_STORAGE_BUCKET_ARTIFACTS=artifacts
- NODE_SHARED_SECRET
- ONLINE_WINDOW_SEC=30
- DEVICE_GRACE_WAIT_MS=15000
- RUN_CONCURRENCY=1
- (선택) SENTRY_DSN

---
