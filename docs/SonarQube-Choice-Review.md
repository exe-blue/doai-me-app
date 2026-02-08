# SonarQube / Problems — 선택 기반 이슈 파일 리뷰

수정이 **선택**에 따라 달라져서, 컨텍스트와 가능한 선택지를 정리한 문서입니다.  
(이미 적용한 수정: 불필요 assertion 제거, `node:` prefix, `Number.parseInt`/`Object.hasOwn`/readonly props/array key/codePointAt 등)

---

## 1. Cognitive Complexity (S3776) — 리팩터 필요

### 1.1 `node-agent/src/workflowDsl.ts` (약 59행)

- **규칙**: 함수 인지 복잡도를 24 → 15 이하로 낮추기.
- **컨텍스트**: DSL 스텝 정규화/검증 함수. `switch`·여러 분기·중첩으로 step kind별 처리.
- **선택지**:
  - **A.** step kind별로 작은 함수로 분리 (예: `normalizeAdbStep`, `normalizeVendorStep`, `normalizeUploadStep`)하고 메인 함수는 kind 분기만 두기.
  - **B.** step kind → handler 맵 객체로 바꿔서 if/switch 체인을 한 번의 lookup으로 줄이기.
  - **C.** 복잡도 임계값만 완화 (Sonar 설정 변경). 동작 변경 없음.
- **권장**: A 또는 B로 분리하면 테스트·유지보수에 유리. B는 새 step kind 추가 시 맵만 수정하면 됨.

### 1.2 `node-agent/src/workflowExecutor.ts` (약 145행)

- **규칙**: 함수 인지 복잡도를 19 → 15 이하로 낮추기.
- **컨텍스트**: 스텝 실행 함수. `kind`(adb / vendor / upload)별 분기, 타임아웃·재시도·에러 처리.
- **선택지**:
  - **A.** kind별 실행 함수로 분리 (예: `runAdbStep`, `runVendorStep`, `runUploadStep`) 후 메인에서는 kind에 따라 호출만.
  - **B.** Strategy 패턴: `StepRunner` 맵에 kind → async runner 등록하고 한 번에 실행.
  - **C.** 복잡도 임계값만 완화.
- **권장**: A 또는 B. 업로드/벤더 로직이 길어지면 A가 읽기 쉬움.

### 1.3 `app/dashboard/runs/page.tsx` (약 187행)

- **규칙**: 함수 인지 복잡도를 17 → 15 이하로 낮추기.
- **컨텍스트**: Runs 대시보드 페이지 컴포넌트. 폼 상태·노드 선택·타임아웃 검증·run 생성·테이블 렌더링이 한 컴포넌트에 있음.
- **선택지**:
  - **A.** 훅으로 분리: `useRunForm()`, `useNodeList()`, `useWorkflowList()` 등으로 상태·로직을 빼고 페이지는 조합만.
  - **B.** 하위 컴포넌트 분리: RunForm, RunTable, NodeSelector 등으로 나누고 props로 연결.
  - **C.** 복잡도 임계값만 완화.
- **권장**: A+B 조합. 먼저 커스텀 훅으로 로직을 빼면 복잡도가 가장 쉽게 내려감.

---

## 2. 중첩 4단 초과 (S2004)

### 2.1 `app/dashboard/runs/page.tsx` (약 163행)

- **규칙**: 함수 중첩을 4단 이하로.
- **컨텍스트**: 콜백/effect 내부에 `.then()`·조건문이 겹쳐서 중첩이 깊어짐.
- **선택지**:
  - **A.** `async/await`로 바꾸고 early return으로 분기 줄이기. (예: `const res = await fetch(...); const d = await res.json(); ...`)
  - **B.** fetch 로직을 `useRunForm` 등 훅으로 옮기고, 페이지에서는 훅 결과만 사용.
  - **C.** then 체인은 유지하되 내부를 작은 named 함수로 쪼개기 (예: `function handleNodesResponse(d) { ... }`).
- **권장**: A 또는 B. B가 1.3 복잡도 이슈와 같이 해결됨.

### 2.2 `components/theme-changer.tsx` (약 58행)

- **규칙**: 함수 중첩을 4단 이하로.
- **컨텍스트**: 테마 변경 UI. 이벤트 핸들러/콜백 안에 조건·중첩 호출이 있음.
- **선택지**:
  - **A.** 클릭/선택 로직을 작은 함수로 분리 (예: `function applyTheme(value) { ... }`)하고 JSX에서는 참조만.
  - **B.** 중첩된 부분을 별도 컴포넌트로 빼서 props로 전달.
  - **C.** 조건을 변수/헬퍼로 위로 끌어올려서 한 단계 낮추기.
- **권장**: A. 테마 적용 로직이 한 곳에 모이면 재사용·테스트에 유리.

---

## 3. 요약 표

| 파일 | 규칙 | 선택 시 고려사항 |
|------|------|------------------|
| `node-agent/src/workflowDsl.ts` | S3776 | step kind 추가 시 맵/함수만 추가할 수 있게 구조화할지 여부 |
| `node-agent/src/workflowExecutor.ts` | S3776 | adb/vendor/upload 각각 테스트하기 쉬운지 |
| `app/dashboard/runs/page.tsx` | S3776, S2004 | 훅/서브 컴포넌트로 나눌지, 한 페이지에 유지할지 |
| `components/theme-changer.tsx` | S2004 | 테마 로직을 훅/유틸로 분리할지 |

위 항목들은 **동작이 바뀌지 않는 범위**에서 리팩터 시 위 선택지를 참고하면 됩니다.  
null/두 값 중 하나를 골라야 하는 타입 이슈는 현재 목록에 없습니다.

---

## 4. 이번 랄프 루프에서 수정한 항목 (확실한 것만)

| 파일 | 규칙 | 조치 |
|------|------|------|
| `app/api/runs/route.ts` | S1854 useless assignment | `mode`, `defaults`, `created_at` 변수 제거 |
| `app/(app)/content/page.tsx` | S7746 Prefer throw over Promise.reject | `throw new Error(...)` 로 변경 |
| `app/(app)/content/page.tsx` | S6671 Rejection reason to be Error | `Promise.reject()` → `throw new Error("Sync failed")` |
| `app/(app)/loading.tsx` | S6479 Array index in keys | `key={i}` → 고정 id 배열 `["sk1",...,"sk6"]` 로 `key={id}` |
| `app/api/sentry-example-api/route.ts` | S1763 Unreachable code | `throw` 이후 unreachable `return` 제거 및 미사용 NextResponse import 제거 |

---

## 5. 건드리지 않은 항목 (선택/애매 — 끝에 표시)
- **Nested ternary (S3358)**: content/page.tsx, runs/[runId]/page.tsx, playbooks/route.ts — 스타일/가독성 리팩터; 동작 변경 없이 별도 작업 권장.
- **Cognitive Complexity (S3776)**: api/runs/route.ts 등 — 함수 분리/맵 전환 등 구조 리팩터 필요; 별도 작업 권장.
- **runs/[runId]/page.tsx (S6479 Array index in keys)**: `logs_tail.map((line, i) => ... key={\`log-${selected.index}-${i}-...\`})` — 로그 줄은 중복 가능해 인덱스 없이 고유 key 만들기 애매함. 현재 복합 key 유지.
