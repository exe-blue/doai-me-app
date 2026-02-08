# P0 골격·운영 고정 — 작업 계획

> **우선순위 룰**: (1) 운영이 멈추지 않게 (2) 관측 가능하게 (3) 데이터 모델이 흔들리지 않게 (4) 그 다음 UX/실시간성

---

## 1. 요구사항 요약

### P0 (이번 스프린트 필수)

| ID | 항목 | 내용 |
|----|------|------|
| 0-1 | DB 스키마 최소 골격 | nodes, devices(index_no), command_assets, playbooks, runs, **run_device_states**, **run_steps**, artifacts, scan_jobs. 기존 테이블 유지·보강. |
| 0-2 | 실행 엔진 정책 | Offline 제외(=skipped_offline), 무응답/에러 시 grace wait 15s 후 다음, 동시성 1(순차) |
| 0-3 | 화면 4개 최소 | `/` 대시보드(24h KPI + To-do + 미니 히트맵), `/commands`(테이블+빌더+확률), `/devices`(히트맵+스캔+상세), `/runs`, `/runs/[runId]`(히트맵+로그/스크린샷) |
| 0-4 | 실시간 | 폴링 고정: /devices 3초, /runs/[runId] 1.5초. WebSocket/SSE는 P2 |

### P0 API 우선순위

1. **실행 루프**: POST /api/playbooks, POST /api/runs, GET /api/runs/:runId, POST /api/nodes/callback(멱등 event_id)
2. **기기 운영**: GET /api/nodes/status (index별 online/offline), POST /api/nodes/scan
3. **대시보드**: GET /api/dashboard?window=24h (폴링 10~30초)

### P1 (P0 직후)

- YouTube URL 수동 등록 + 프리뷰 (/content)
- 채널 등록 + 3분 폴링 동기화
- 온보딩 페이지(정보 + 프리셋 3~4개)

### P2 이후

- WebSocket/SSE 전환 조건: 폴링 부하·운영 피드백
- 채널별 동적 폴링, 멀티테넌시

---

## 2. 수용 기준

- [ ] DB: devices에 index_no, runtime_handle, label 추가; run_device_states, run_steps 테이블 추가; runs.target, runs.last_error_message 등 보강
- [ ] 실행: offline 스킵, grace_wait 15s, concurrency 1 반영 (Node/API)
- [ ] API: playbooks POST, runs POST/GET/:runId, nodes/callback(멱등), nodes/status, nodes/scan, dashboard GET
- [ ] 화면: 4개 라우트 히트맵 재사용, 폴링 주기 적용

---

## 3. 구현 순서 (8단계)

| # | 단계 | 산출물 |
|---|------|--------|
| 1 | DB migrate (P0 골격) | run_device_states, run_steps, devices/runs/artifacts 보강 |
| 2 | /commands 테이블 + 빌더 + playbook 저장 | POST /api/playbooks, UI |
| 3 | /runs 생성 + Node 실행 + run_steps 기록 | POST /api/runs, callback → run_steps |
| 4 | /runs/[runId] 모니터 (히트맵+로그) | GET /api/runs/:runId, 1.5s 폴링 |
| 5 | /devices 히트맵 + 스캔 시작 | GET /api/nodes/status(3s), POST scan |
| 6 | / 대시보드 24h KPI + To-do | GET /api/dashboard |
| 7 | YouTube URL 프리뷰/수동 등록 (P1) | /content 입력 + videos.list |
| 8 | 온보딩 페이지 (프리셋 3~4개) | /onboarding |

---

## 4. 리스크·완화

| 리스크 | 완화 |
|--------|------|
| 기존 runs/device_tasks와 신규 run_device_states/run_steps 이중화 | 기존 테이블 유지, callback에서 두 곳 동기 기록 또는 점진 이전 |
| devices.index_no 없음 | nullable 추가, 스캔/등록 시 index 부여 정책 명시 |
| Node 미배포 시 모니터 빈 화면 | API는 run_device_states/run_steps 기준 응답, 없으면 빈 배열 |

---

## 5. 파일 참조

- 스키마: `supabase/migrations/20250208900000_p0_run_observability.sql`
- 실행 정책: `node-agent/src/workflowRunner.ts`, `app/api/nodes/callback/route.ts`
- API: `app/api/playbooks/route.ts`, `app/api/runs/route.ts`, `app/api/runs/[runId]/route.ts`, `app/api/nodes/callback/route.ts`, `app/api/nodes/status/route.ts`, `app/api/nodes/scan/route.ts`, `app/api/dashboard/route.ts`
- 화면: `app/(app)/dashboard/page.tsx`, `app/(app)/commands/page.tsx`, `app/(app)/devices/page.tsx`, `app/(app)/runs/page.tsx`, `app/(app)/runs/[runId]/page.tsx`
