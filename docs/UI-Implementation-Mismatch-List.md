# UI 구현과 화면 반영 불일치 목록

코드의 의도(또는 설계 문서의 요구)와 실제 화면 동작이 맞지 않는 구성요소를 정리한 문서입니다.  
(예: 미니맵에서 “안 되면 비어 있는 상자”로 보여야 하는데, 그리드 자체가 안 보이는 경우)

---

## 1. 대시보드 미니맵 — UI 구현방안 (전제: 노드당 100슬롯, 노드 복수)

**전제**
- 노드 1개 = 기기 슬롯 100개(10×10 그리드 1개).
- 노드가 복수 개 존재한다.

**데이터 구조**
- API: `GET /api/dashboard` 의 `mini_heatmap` 을 **노드 단위**로 반환.
  - 예: `mini_heatmap: { nodes: { node_id: string; items: HeatmapItem[] }[] }`  
  - 각 `items` 는 해당 노드의 인덱스 1~100에 대한 배열(부족분은 클라이언트에서 offline placeholder 로 채움).
- ViewModel: `miniHeatmapByNode: { node_id: string; items: HeatmapItem[] }[]` 로 페이지에 전달.

**UI 구현**
- 노드가 0개: 그리드 비표시, "등록된 노드 없음" 등 안내 문구만 표시.
- 노드가 1개 이상: **노드별로 10×10 그리드 1개씩** 렌더.
  - 각 그리드는 항상 100칸. 해당 노드에 기기가 없거나 오프라인인 칸은 **비어 있는 상자(offline 스타일)** 로 표시.
  - 노드 구분: 그리드 위/옆에 `node_id`(또는 노드 이름) 라벨 표시.
  - 배치: 노드별 그리드를 가로로 나열(스크롤) 또는 2열 등으로 줄바꿈. 미니 타일 크기(예: 24px) 유지.
- 타일 클릭: `(node_id, index)` 를 전달해 기기 화면으로 이동. 예: `/devices?node=${node_id}&sel=${index}` 또는 기존 `/devices?sel=${index}` 를 노드별 인덱스 체계에 맞게 확장.

**요약**
- 미니맵 = “노드별 100슬롯 그리드”를 복수 개 표시.
- 빈/오프라인 슬롯은 항상 **빈 상자**로 그리며, 그리드 자체를 데이터 없음으로 숨기지 않음.

---

## 2. 대시보드 — "Offline 기기 수 (24h)" 차트 (시간대별이 아님 + 빈 데이터 시 1개 막대만 표시)

| 항목 | 내용 |
|------|------|
| **위치** | `app/(app)/page.tsx` — "Offline 기기 수 (24h)" ChartCard |
| **의도/계약** | 제목·부제가 **"24h"**, **"시간대별"** 이므로, 0~23시 각 시간대별 막대가 24개 있어야 한다. |
| **현재 구현** | (1) API `GET /api/dashboard` 는 `device_offline_per_hour` 를 **현재 스냅샷 1개**만 반환한다 (`app/api/dashboard/route.ts`: `deviceOfflinePerHour = [{ t: startISO, offline: devicesOffline }]`). (2) UI는 데이터가 없을 때 `[{ t: "", value: 0 }]` 로 폴백해서 **막대 1개**만 그린다. |
| **불일치** | (1) **API vs UI 라벨**: UI는 “시간대별”인데 API는 시간대별 히스토리가 아니라 “현재 시점 offline 수” 1개만 준다. (2) **폴백**: “시간대별 실행량”은 데이터 없을 때 `Array.from({ length: 24 }, ...)` 로 24개 막대를 그리는데, Offline 기기 수는 1개만 그려서 두 차트의 “데이터 없음” 스타일이 다르다. |
| **수정 방향** | (1) 단기: 데이터 없을 때도 24개 슬롯을 그리도록 `offlinePerHour.length ? ... : Array.from({ length: 24 }, (_, i) => ({ t: \`${i}:00\`, value: 0 }))` 등으로 맞춘다. (2) 장기: “시간대별”을 진짜로 쓰려면 API에서 시간대별 offline 이력(또는 집계)을 내려주고, UI는 그 24개를 그리도록 한다. |

---

## 3. (참고) DeviceHeatmap 두 종류와 데이터 형태

| 항목 | 내용 |
|------|------|
| **위치** | `components/DeviceHeatmap.tsx` vs `components/dashboard/device-heatmap.tsx` |
| **구현** | (1) **DeviceHeatmap.tsx**: `items: HeatmapItem[]` 를 받고, 내부에서 **항상 100칸**을 채운다. `byIndex.get(idx) ?? { index: idx, online: false, activity: "idle" }` 로 빈 인덱스는 offline placeholder. (2) **device-heatmap.tsx**: `devices: (DeviceTileData \| null)[]` 를 받고, `devices[i] ?? null` 로 100칸을 채우며, null이면 "—" + muted 스타일로 **빈 상자**를 그린다. |
| **불일치** | 두 컴포넌트가 **다른 props/타입**을 쓰고, 사용처가 다르다. `app/(app)/*` 는 전부 `components/DeviceHeatmap.tsx`(HeatmapItem[])만 사용 중이라, “빈 상자가 안 보이는” 문제는 위 1번처럼 **페이지 쪽 조건 분기**에서만 발생한다. device-heatmap.tsx는 “항상 100칸 + 빈 칸은 상자로 표시”를 만족하지만, 대시보드 미니맵은 DeviceHeatmap.tsx를 쓰면서 **length === 0 일 때 그리드를 아예 안 그리는** 쪽이 불일치 원인이다. |

---

## 4. Run 모니터 — 히트맵 (참고: 여기는 일치)

| 항목 | 내용 |
|------|------|
| **위치** | `app/(app)/runs/[runId]/page.tsx` |
| **구현** | `loading && heatmapItems.length === 0` 일 때만 스켈레톤, 그 외에는 항상 `<DeviceHeatmap items={heatmapItems} ... />` 를 렌더한다. |
| **상태** | `items`가 빈 배열이어도 `DeviceHeatmap`이 100개 placeholder를 채우므로, **빈 상자 100개가 보인다**. 구현과 UI 반영이 일치한다. |

---

## 요약 리스트

| # | 화면/컴포넌트 | 불일치 요약 | 우선순위 |
|---|----------------|-------------|----------|
| 1 | 대시보드 기기 미니맵 | 기기 0대일 때 그리드 전체를 숨김 → 항상 10×10 그리드 + 빈 칸은 비어 있는 상자로 표시해야 함 | 높음 |
| 2 | 대시보드 "Offline 기기 수 (24h)" | (1) API는 현재 스냅샷 1개만 반환하는데 라벨은 "시간대별" (2) 데이터 없을 때 막대 1개만 표시 → 24개 슬롯/시간대별 기대와 불일치 | 중간 |
| 3 | DeviceHeatmap vs device-heatmap | HeatmapItem[] vs DeviceTileData[] 두 구현 공존; 미니맵 문제는 1번 조건 분기 수정으로 해결 가능 | 참고 |

이 문서는 Prometheus/계획·Ralph 검증 시 “UI와 구현 불일치” 항목으로 참고할 수 있습니다.
