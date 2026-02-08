# 갭 리스트: 페이지 vs 미반영 핵심 기능/API

> 페이지는 나왔는데 아직 화면에 제대로 반영되지 않은 핵심 기능·API 정리. 구현 우선순위·QA 검증 기준용.

---

## A. 노드 실행 엔진 관련 (가장 중요, UI에 '간접'만 반영됨)

| # | 항목 | API/동작 | UI 갭 |
|---|------|----------|--------|
| 1 | **작업 할당 Pull 엔진** | `POST /api/nodes/pull` + DB lease/lease_token 기반 할당 | 결과만 보임(실행 상태). "할당이 왜 안 되는지"를 보는 뷰 없음 |
| 2 | **콜백 멱등 처리** | `POST /api/nodes/callback` + node_events(event_id)로 중복 방지 | "중복 이벤트/늦은 이벤트가 무시됐는지" 감사 로그 없음 |
| 3 | **노드 상태/버전/헬스** | `POST /api/nodes/heartbeat` (권장) 또는 `/api/nodes/status` 확장 | 노드 단위(4대+) "마지막 체크인, 러너 버전, 실패율" 등 운영 지표가 약함 |

---

## B. 명령 라이브러리/조합 관련 (Commands 페이지 존재, 핵심 누락 가능)

| # | 항목 | API/동작 | UI 갭 |
|---|------|----------|--------|
| 1 | **Command Asset 업로드/버전** | `POST /api/command-assets/upload` (필요) | 테이블은 있어도 "파일 등록/업로드/폴더/버전"이 약함 |
| 2 | **Ref resolve (조합형 플레이북)** | Playbook step `type:"ref"` → 서버/노드에서 참조 해석 고정 | `GET /api/command-assets/:id` 또는 "resolve된 payload를 pull이 내려줌" 중 택1 필요 |
| 3 | **Catalog(Claude DOM 액션) 관리** | `GET /api/catalogs`, `GET /api/catalogs/:id` (읽기 전용) | "Catalog 보기"가 없거나 약함 |

---

## C. 관측/아티팩트 (모니터에서 보여주지만 API 보강 필요)

| # | 항목 | API/동작 | UI 갭 |
|---|------|----------|--------|
| 1 | **로그 tail 조회 표준** | `/api/runs/:runId`에 섞어서 가능하나, 별도 엔드포인트 권장 | `GET /api/runs/:runId/logs?device=57&tail=200` 있으면 디버깅 용이 |
| 2 | **아티팩트 목록/프리사인 URL** | `GET /api/runs/:runId/artifacts?device=57` | Storage 직접 링크 만료/권한 시 서버에서 signed URL 발급 필요 가능 |

---

## D. 스캔/자동 등록 (100대 OTG 운영)

| # | 항목 | API/동작 | UI 갭 |
|---|------|----------|--------|
| 1 | **스캔 시작/진행** | `POST /api/nodes/scan`, `GET /api/nodes/scan/:scanId` | "스캔 시작" 버튼/진행 로그가 부족할 수 있음 |

---

## 참고

- API 명세 (구현·운영 기준): [../api/v0.1.md](../api/v0.1.md)
- Node 프로토콜만: [../contracts/node-protocol.md](../contracts/node-protocol.md)
- 운영자 콘솔 페이지 맵: [../spec/operator-console-pages.md](../spec/operator-console-pages.md)
