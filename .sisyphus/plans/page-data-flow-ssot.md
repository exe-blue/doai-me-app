# 페이지별 데이터 흐름 & SSOT (상태 단일 출처)

## 공통 규칙 (버그 예방)

- **R1** API 응답은 ViewModel로 변환 후 UI에만 전달. raw를 컴포넌트에 직접 주지 않음.
- **R2** Heatmap은 `items: HeatmapItem[]` 하나만 받음. /devices, /runs/[runId], 대시보드 미니맵 동일.
- **R3** 선택 상태(selected)는 URL 또는 페이지 state 한 곳만. devices는 `?sel=57`로 URL 복원.
- **R4** usePolling은 `{ data, loading, error, refreshedAt }` 반환. 300ms+ 로딩 시 Loader, 테이블/히트맵은 Skeleton.

## 구현 상태

| 항목 | 위치 | 비고 |
|------|------|------|
| 폴링 상수 | lib/constants.ts | POLL_INTERVAL_*_MS, LOADER_DELAY_MS |
| usePolling | lib/api.ts | refreshedAt 추가 |
| Dashboard VM | lib/viewmodels/dashboardVM.ts | toDashboardVM, miniHeatmapItems |
| Devices VM | lib/viewmodels/devicesVM.ts | toDevicesVM, toHeatmapItemsFromNodesStatus, offline→activity idle |
| RunMonitor VM | lib/viewmodels/runMonitorVM.ts | toRunMonitorVM, toHeatmapItemsFromRun |
| RunsList VM | lib/viewmodels/runsListVM.ts | toRunsListVM |
| 대시보드 / | app/(app)/page.tsx | VM만 전달, 미니맵 클릭 → /devices?sel=idx |
| 기기 /devices | app/(app)/devices/page.tsx | VM만 전달, selectedIndex = URL ?sel= |
| 실행 목록 /runs | app/(app)/runs/page.tsx | toRunsListVM, status/window 쿼리 |
| 실행 모니터 /runs/[runId] | app/(app)/runs/[runId]/page.tsx | toRunMonitorVM, selectedIndex state + ?selected= 폴링, WAIT 15s 배지 |

## 체크리스트

- [x] Heatmap/Charts/Table이 raw API 구조를 모르도록 ViewModel 경유
- [x] Online/Offline·activity 계산은 devicesVM 한 곳
- [x] run/device key는 index_no(UI 기준) 고정
- [x] 폴링 간격은 lib/constants.ts에서 관리
