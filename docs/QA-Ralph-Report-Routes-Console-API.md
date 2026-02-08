# QA Ralph Report: Routes, Console Errors, Pull/Callback API

**Target**: Next.js app (doai.me / Vercel). **Method**: Playwright + code inspection.

---

## (A) 재현 단계

1. **홈(/)이 대시보드로 뜨는 문제**
   - 브라우저에서 `https://doai.me/` 또는 `http://localhost:3000/` 접속
   - **재현**: 루트 `/`에 접속하면 대시보드 UI(24h 요약, KPI 카드, 미니맵 등)가 표시됨. 랜딩 페이지가 아님.

2. **메뉴 '콘텐츠', '명령' 클릭 시 client-side exception**
   - 앱에서 사이드/하단 메뉴의 **콘텐츠**(→ `/content`) 또는 **명령**(→ `/commands`) 클릭
   - **재현**: "Application error: a client-side exception..." 오버레이 발생. 콘텐츠/명령 페이지가 렌더되지 않음.

3. **Pull/Callback API 점검**
   - 코드/라우트 기준으로 `GET /api/nodes/pull`, `POST /api/nodes/callback` 존재 여부 확인.

---

## (B) 콘솔 첫 에러 전문

```
Uncaught Error: A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.

    at SelectItem (webpack-internal:///(app-pages-browser)/./node_modules/@radix-ui/react-select/dist/index.mjs:1072:15)
    at Object.react_stack_bottom_frame (...)
    at renderWithHooks (...)
    at updateForwardRef (...)
    at beginWork (...)
    ...
    at SelectItem
    at ContentTabs  app/(app)/content/page.tsx (192:21)
    at ContentPage   app/(app)/content/page.tsx (377:7)
```

**발생 위치**: `components/ui/select.tsx` (107:5) `SelectItem` — Radix Select 규칙 위반.  
**호출 경로**: `app/(app)/content/page.tsx` 192행 근처(채널 필터 `<SelectItem value="">전체</SelectItem>`), 동일 패턴이 `app/(app)/commands/page.tsx` 351행(타입 필터 "전체")에도 있음.

---

## (C) 실패한 네트워크 요청 목록 (엔드포인트/상태/응답)

| URL | Method | 상태/실패 |
|-----|--------|-----------|
| `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/.../PretendardVariable.woff2` | GET | net::ERR_ABORTED (폰트 404 가능) |
| `http://localhost:3000/monitoring?o=...&p=...&r=us` | POST | net::ERR_ABORTED (Sentry 터널) |
| `http://localhost:3000/api/channels?sort=alpha` | GET | 500 Internal Server Error (콘텐츠 페이지 로드 시) |
| `http://localhost:3000/api/library/list?` | GET | net::ERR_ABORTED (명령 페이지 내비 시) |

*에러 오버레이 발생 시 API 실패는 페이지 크래시로 인한 중단(ERR_ABORTED)일 수 있음. SelectItem 수정 후 콘텐츠/명령 페이지는 로드됨.*

---

## (D) 원인 1~2개 + 수정안 (최소 변경)

### 원인 1: 루트(/)가 대시보드로 노출됨

- **원인**: App Router에서 루트 경로 `/`가 `(app)` 그룹의 `app/(app)/page.tsx`에 매핑되어 있고, 해당 파일이 **대시보드 컴포넌트**(DashboardPage)를 렌더링함. `next.config.ts` redirect와 `middleware.ts`에는 `/` → 랜딩 처리 없음.
- **수정안**: `next.config.ts`의 `redirects()`에 루트 → 랜딩 리다이렉트 추가.
  ```ts
  { source: '/', destination: '/landing', permanent: false }
  ```
  - 적용 완료.

### 원인 2: 콘텐츠/명령 페이지에서 Radix Select의 빈 문자열 value

- **원인**: `@radix-ui/react-select`는 `<SelectItem value="">`를 허용하지 않음. "전체" 옵션에 `value=""`를 사용한 것이 런타임 에러를 유발함.
  - `app/(app)/content/page.tsx`: 채널 필터 `<SelectItem value="">전체</SelectItem>` (192행 근처)
  - `app/(app)/commands/page.tsx`: 타입 필터 `<SelectItem value="">전체</SelectItem>` (351행 근처)
- **수정안**: 빈 문자열 대신 **sentinel 값**(예: `__all__`) 사용. Select의 `value`/`onValueChange`에서만 `""` ↔ `__all__` 변환.
  - 콘텐츠: `value={channelFilter === "" ? "__all__" : channelFilter}`, `onValueChange={(v) => setChannelFilter(v === "__all__" ? "" : v)}`, `<SelectItem value="__all__">전체</SelectItem>`
  - 명령: `value={typeFilter === "" ? "__all__" : typeFilter}`, `onValueChange={(v) => setTypeFilter(v === "__all__" ? "" : v)}`, `<SelectItem value="__all__">전체</SelectItem>`
  - 적용 완료.

---

## Pull/Callback API 점검 결과 (코드·라우트 기준)

| 엔드포인트 | 메서드 | 파일 | 비고 |
|------------|--------|------|------|
| `/api/nodes/pull` | **GET** | `app/api/nodes/pull/route.ts` | Node 인증(Bearer/X-Node-Auth), `node_id` 쿼리 필수. 리스/잡 1건 반환. |
| `/api/nodes/callback` | **POST** | `app/api/nodes/callback/route.ts` | Node 인증, body로 이벤트 전송. event_id 기준 idempotency, lease 검사. |

- **정리**: pull/callback 방식 백엔드는 **갖추어져 있음**. Pull은 **GET** (노드가 폴링), Callback은 **POST**. Node Agent는 `GET /api/nodes/pull?node_id=...`로 명령을 받고, `POST /api/nodes/callback`으로 이벤트를 보내면 됨.

---

## 검증

- Playwright 스크립트 `scripts/qa-ralph-collect-errors.mjs`로 수정 후 재실행:
  - `/content`, `/commands`: **hasOverlay: false**, **firstClientError: null** (에러 오버레이 사라짐).
- 루트 `/`: redirect로 `/landing` 이동 (설정 적용 후 서버 재시작 필요 시 `npm run dev` 재실행).
