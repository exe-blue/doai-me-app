# 기획 에이전트 핸드오프 — 결과만 나열

- 대시보드 미니맵 전제: 노드 1개당 100슬롯(10×10), 노드 복수.
- 대시보드 미니맵 UI: API mini_heatmap 노드 단위. 노드별 10×10 그리드 표시. 빈/오프라인 = 빈 상자. 노드 0개일 때만 "등록된 노드 없음". 타일 클릭 → (node_id, index) 기기 화면.
- Offline 기기 수 (24h): API 스냅샷 1개, 라벨 "시간대별", 폴백 막대 1개 → 불일치.
- 미니맵 기존: length > 0 일 때만 그리드, 0이면 문구만 → 그리드 미표시 불일치.
- DeviceHeatmap 두 종류 공존. app/(app)/* 는 DeviceHeatmap.tsx.
- Run 모니터 히트맵: 빈 items여도 100칸 표시. 일치.
- 상세: docs/UI-Implementation-Mismatch-List.md
