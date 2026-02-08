# 개발 에이전트 핸드오프 프롬프트 (P0 구현 우선)

## 목표

OTG 100대 운영을 전제로, 멈추지 않는 실행 + 관측 가능(로그/스크린샷) + Online/Offline 히트맵 중심 UI를 P0로 완성한다.
추가 기능(콘텐츠/온보딩/유튜브)은 P1로 미룬다.

## 운영 기본값(하드코딩 OK)

- **ONLINE_WINDOW_SEC** = 30
- **DEVICE_GRACE_WAIT_MS** = 15000
- **RUN_CONCURRENCY** = 1 (디바이스 1대씩 순차)
- **정책**
  - Offline(online=false) 디바이스는 실행 대상에서 제외하고 skipped_offline으로 기록
  - 실행 중 무응답/에러 시 15초 grace wait 후 해당 디바이스는 실패 처리하고 다음 디바이스 진행 (전체 run이 멈추면 안 됨)

---

## P0 범위 (이번 스프린트 구현)

### 1) 라우트/메뉴(한국어)

- 대시보드 **/**
- 명령 **/commands**
- 기기 **/devices**
- 실행 **/runs**
- 실행 상세 **/runs/[runId]**  
(콘텐츠 /content는 P1)

기존 /dashboard/*는 새 라우트로 정리. /dashboard가 있으면 / 또는 /devices로 redirect.

---

## 2) DB 스키마(P0 최소)

Supabase Postgres migrate로 아래 테이블만 우선 생성(필드 최소화).

- **nodes**: id (text, pk) 예: PC-01, name, last_seen, last_error_message, timestamps
- **devices**: id (uuid), index_no (int, unique), device_id (text, unique, nullable), runtime_handle, node_id (fk), label, last_seen, last_error_message, timestamps
- **command_assets**: id, type enum, title, folder, storage_path, default_timeout_ms, timestamps
- **playbooks**: id, title, steps (jsonb), timestamps
- **runs**: id, title, mode ('playbook'|'workflow'), playbook_id, workflow_id, params, target, status, created_at, started_at, finished_at, last_error_message
- **run_device_states**: run_id, device_index, status, current_step_index, last_seen, last_error_message, unique(run_id, device_index)
- **run_steps**: run_id, device_index, step_index, step_id, step_type, status, probability, decision, started_at, finished_at, error_message
- **artifacts**: run_id, device_index, kind ('screenshot'|'log'), storage_path, created_at

(선택) scan_jobs는 P0 후반에 추가해도 됨.

---

## 3) 공통 ViewModel(버그 예방 핵심)

UI는 API raw를 직접 쓰지 말고, 페이지 레벨에서 아래 형태로 변환해 Heatmap에 공급할 것.

```ts
type HeatmapItem = {
  index: number;
  online: boolean;
  activity?: "idle"|"running"|"waiting"|"error"|"done";
  progress?: { current: number; total: number };
  last_seen?: string;
  last_error_message?: string;
};
```

---

## 4) API(P0 폴링 기반)

- **Playbook**: POST /api/playbooks → {id}, GET /api/playbooks/:id
- **Runs**: POST /api/runs (mode: playbook/workflow), GET /api/runs, GET /api/runs/:runId, POST /api/runs/:runId/stop
- **Devices/Nodes**: GET /api/nodes/status (3초 폴링), (선택) GET /api/devices/:index, (P0 후반) POST /api/nodes/scan
- **Node Callback**: POST /api/nodes/callback, X-Node-Auth, body: { event_id, type, node_id, payload }, type: device_heartbeat | run_step_update | artifact_created | scan_progress, 멱등성(event_id)

P0에서는 WebSocket/SSE 사용하지 말고 폴링으로. Realtime 전환은 P2.

---

## 5) UI 페이지별 요구사항(P0)

- **/** 대시보드: GET /api/dashboard?window=24h (15~30초 폴링), KPI 6개 + 시간대별 실행량 + Offline 추이 + To-do + 미니 히트맵
- **/devices**: 히트맵(10x10) + 필터/검색, 타일 클릭 → 우측 drawer(last_seen, last_error_message, 마지막 스샷)
- **/runs, /runs/[runId]**: 리스트 상태/카운트, 상세 히트맵 + drawer(현재 step/로그 50줄/마지막 스샷), activity=waiting 표기
- **/commands**: 중앙 테이블 + 우측 builder(순서/확률/timeout/retry/onFailure), "저장(playbook)" + "즉시 실행(run 생성 후 /runs/[runId])", command_assets 업로드는 P0 말미 또는 P1

---

## 6) 로더/테마(P0 포함)

- 전역 로더: 300ms 이상 지연 시 로더, 3초 이상 "연결 확인 중…"
- 컴포넌트 최소 세트: DeviceHeatmap, DataTable, Drawer, KpiCard, ChartCard, Loader, Skeleton, Toast
- 상태 색/테두리: 배경 online/offline, 테두리 running/waiting/error/done/idle

---

## 7) 크론/잡

P0에서는 제외. Vercel Cron(유튜브 동기화)은 P1에서 추가.

---

## 산출물(DoD)

1. migrate 완료 후 테이블 생성 확인
2. /devices 히트맵이 online/offline로 정상 갱신(폴링)
3. /commands에서 playbook 생성 → run 생성 → /runs/[runId]에서 step/log/스크린샷 관측
4. Offline 디바이스는 실행 스킵, 에러/무응답은 grace wait 후 다음 디바이스로 진행(전체 run 멈추지 않음)
5. 전역 로더/토스트/스켈레톤 동작

---

## 환경변수(Vercel)

- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY(필요 시)
- SUPABASE_STORAGE_BUCKET_COMMAND_ASSETS=command-assets, SUPABASE_STORAGE_BUCKET_ARTIFACTS=artifacts
- NODE_SHARED_SECRET, ONLINE_WINDOW_SEC=30, DEVICE_GRACE_WAIT_MS=15000, RUN_CONCURRENCY=1
- (선택) SENTRY_DSN

---

# 현재 레포 파일 구조 (폴더 경로)

```
app/
  (app)/                    # 앱 레이아웃(사이드바/탑바)
    layout.tsx              # AppShell, SideNav, TopBar, main
    loading.tsx
    page.tsx                # 대시보드 /
    commands/page.tsx       # 명령
    content/page.tsx        # 콘텐츠 (P1)
    devices/page.tsx        # 기기
    runs/page.tsx           # 실행 목록
    runs/[runId]/page.tsx   # 실행 상세
    dashboard/              # 기존: redirect 정리 대상
      page.tsx
      artifacts/, onboarding/, playbooks/, settings/, videos/, workflows/
    onboarding/page.tsx
  (public)/                 # 랜딩/블로그 등
    layout.tsx
    landing/page.tsx
    blog/, introduction/, notes/, projects/, workbench/
  api/
    dashboard/route.ts
    devices/route.ts
    devices/[index]/route.ts
    nodes/status/route.ts
    nodes/scan/route.ts
    nodes/scan/[scanJobId]/route.ts
    nodes/callback/route.ts
    playbooks/route.ts
    playbooks/[id]/route.ts
    runs/route.ts
    runs/[runId]/route.ts
    runs/[runId]/stop/route.ts
    runs/[runId]/steps/route.ts
    channels/, content/, cron/, health/, library/, workflows/
  globals.css
  layout.tsx

lib/
  api.ts                    # usePolling, apiGet
  constants.ts              # POLL_INTERVAL_*, LOADER_DELAY_MS
  heatmap.ts                # HeatmapItem, deviceToHeatmapItem, runDeviceStateToHeatmapItem
  tokens.ts                 # 디자인 토큰(device/activity/text)
  time.ts
  viewmodels/
    dashboardVM.ts
    devicesVM.ts
    runMonitorVM.ts
    runsListVM.ts

components/
  DeviceHeatmap.tsx         # items: HeatmapItem[] 만 받음
  DataTable.tsx
  Drawer.tsx
  KpiCard.tsx
  ChartCard.tsx
  Loader.tsx
  Skeleton.tsx              # HeatmapSkeleton, TableSkeleton
  Toast.tsx
  GlobalLoader.tsx
  app/
    AppSideNav.tsx
    kpi-card.tsx
    data-table.tsx
    heatmap.tsx
  dashboard/
    dashboard-sidebar.tsx
    dashboard-topbar.tsx
    device-heatmap.tsx
    mobile-bottom-nav.tsx
  ui/                       # shadcn 등 기반

supabase/migrations/
  ...                       # P0 관련: run_device_states, run_steps, devices.index_no 등
```

---

# PR 단위 작업 목록

에이전트가 바로 PR을 쪼개서 작업할 수 있도록, **현재 경로 기준** 작업 단위.

| # | PR 제목 (예시) | 경로/파일 | 작업 내용 |
|---|----------------|-----------|-----------|
| 1 | P0: /dashboard → / redirect | `app/(app)/dashboard/page.tsx`, (선택) middleware 또는 redirect 페이지 | /dashboard 접근 시 / 또는 /devices로 redirect. 기존 dashboard 하위(artifacts, playbooks 등)는 유지하되 메뉴는 /, /commands, /devices, /runs만 노출 |
| 2 | P0: DB 스키마 정합성 점검 | `supabase/migrations/*.sql` | 스펙 2) 대비 nodes, devices, command_assets, playbooks, runs, run_device_states, run_steps, artifacts 테이블/컬럼 존재 여부 확인. 부족 시 마이그레이션 추가 |
| 3 | P0: 운영 기본값 상수 통일 | `lib/constants.ts`, `node-agent/src/config.ts` | ONLINE_WINDOW_SEC=30, DEVICE_GRACE_WAIT_MS=15000, RUN_CONCURRENCY=1 한 곳에서 참조. 정책 문서(docs/execution-policy-p0.md)와 일치 |
| 4 | P0: HeatmapItem ViewModel 단일화 | `lib/heatmap.ts`, `lib/viewmodels/*.ts` | UI는 HeatmapItem[] 만 받도록 유지. toDashboardVM, toDevicesVM, toRunMonitorVM, toRunsListVM에서 raw → VM 변환만 담당 |
| 5 | P0: Playbook API 검증 | `app/api/playbooks/route.ts`, `app/api/playbooks/[id]/route.ts` | POST → {id}, GET :id → id, title, steps, updated_at. 에러 시 { error: { code, message } } |
| 6 | P0: Runs API 검증 | `app/api/runs/route.ts`, `app/api/runs/[runId]/route.ts`, `app/api/runs/[runId]/stop/route.ts` | POST(mode, playbook_id/workflow_id, params, target, defaults), GET 목록(counts 포함), GET :runId(heatmap.items, selected), POST stop |
| 7 | P0: Nodes/Devices API 검증 | `app/api/nodes/status/route.ts`, `app/api/devices/[index]/route.ts`, `app/api/nodes/scan/route.ts` | GET nodes/status → heatmap.items(3초 폴링), GET devices/:index(선택), POST nodes/scan(P0 후반) |
| 8 | P0: Node Callback 멱등/타입 | `app/api/nodes/callback/route.ts` | event_id 중복 시 200 + { ok: true, duplicate: true }. type: device_heartbeat, run_step_update, artifact_created, scan_progress 처리 |
| 9 | P0: 대시보드 페이지 VM 전용 | `app/(app)/page.tsx` | GET /api/dashboard?window=24h → toDashboardVM → KpiGrid, Chart, Todo, MiniHeatmap만 VM 데이터로 렌더. 폴링 간격 lib/constants |
| 10 | P0: 기기 페이지 VM·URL 선택 | `app/(app)/devices/page.tsx` | GET /api/nodes/status → toDevicesVM → DeviceHeatmap(heatmapItems). 선택은 ?sel= 로만 관리(복붙 프롬프트 R3) |
| 11 | P0: 실행 목록/상세 VM | `app/(app)/runs/page.tsx`, `app/(app)/runs/[runId]/page.tsx` | toRunsListVM, toRunMonitorVM 사용. 상세는 heatmapItems + selected, activity=waiting 시 "WAIT 15s…" 표기 |
| 12 | P0: 명령 페이지 Builder 연동 | `app/(app)/commands/page.tsx` | 테이블(명령 리스트) + 우측 builder(step 순서/확률/timeout/retry/onFailure). 저장 → POST playbooks. 즉시 실행 → POST runs → 이동 /runs/[runId] |
| 13 | P0: 전역 로더·스켈레톤 규칙 | `components/GlobalLoader.tsx`, `components/Loader.tsx`, `components/Skeleton.tsx`, `lib/constants.ts` | 300ms 이상 로딩 시 로더, 3초 이상 "연결 확인 중…". 히트맵/테이블은 Skeleton. LOADER_DELAY_MS 사용 |
| 14 | P0: 상태 색/테두리 토큰 | `lib/tokens.ts`, `app/globals.css`, `components/DeviceHeatmap.tsx` | 배경 online/offline, 테두리 running/waiting/error/done/idle. Heatmap은 tokens만 참조 |

**사용법**: 위 표를 복사해 이슈/PR 설명에 붙이고, "# N" 단위로 브랜치 생성 후 작업 → PR 시 이 문서 링크 + 해당 # 번호 명시.
