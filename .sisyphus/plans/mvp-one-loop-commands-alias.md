# MVP: 1회 완주 + /commands alias 고정

**원칙**: 기능 확장보다 **「웹 Run → 노드 실행 → callback → 웹 반영」 1회 완주**가 전부. URL은 **/commands로 통일**하고, **내부 이름은 건드리지 말고 alias만** 써서 빌드 누락을 막는다.

---

## 1. 목표 (단일)

- 웹에서 Run 생성 → 노드가 pull로 작업 수신 → (adb/스크립트) 실행 → callback으로 결과 보고 → 웹이 폴링/SSE로 상태 반영
- 이 **한 번의 완주**만 검증/유지. 신규 기능은 이 루프가 안정된 뒤에만.

---

## 2. URL/명칭 (필수)

- **사용자-facing URL**: `/`, `/dashboard`, `/devices`, **`/commands`**, `/runs` 만 사용.
- **/commands**:
  - 겉으로는 **URL만 /commands**.
  - **내부** 폴더/DB/테이블명(`command_catalogs` 등)은 **변경하지 않음**.
  - **리다이렉트(alias)만** 추가: `/command_catalogs` → `/commands`, `/dashboard/library` → `/commands` (이미 `next.config.ts`에 반영).
- **삭제/이동 없음** → 빌드·경로 누락 방지.

---

## 3. 1회 완주 검증 체크리스트

| 단계 | 확인 항목 |
|------|-----------|
| 웹 Run 생성 | `POST /api/runs` → `run_id` 반환 |
| 노드 pull | `GET /api/nodes/pull?node_id=...` → job 1건 (lease) |
| 노드 실행 | `runJob` → adb/스크립트 실행, 실패 시 15초 후 스킵 |
| callback | `POST /api/nodes/callback` (event_id 멱등, lease_token) |
| 웹 반영 | `/runs`, `/runs/[runId]` 폴링으로 상태 갱신 |

---

## 4. 참고 문서

- `docs/guide/mvp-routes-and-backend.md` — 5 URL 고정, pull/callback, node-runner 역할
- `docs/guide/mvp-one-adb-flow.md` — adb 1개 실행 플로우 상세
- `next.config.ts` — redirects (alias만 추가)
