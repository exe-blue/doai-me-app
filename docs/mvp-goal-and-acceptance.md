# MVP 목표 및 완료 기준

doai.me 웹에서 명령/콘텐츠/잡을 관리하고, Windows 노드 러너(EXE)가 로컬 ADB/Xiaowei/에뮬레이터 API를 실행한 뒤 결과를 웹으로 콜백하여 “실시간에 가까운 상태/로그/완료”가 보이도록 한다. UI는 심플, 장치는 online/offline만.

---

## 0) 긴급 버그픽스 (프론트) — 완료

- **문제:** `/commands`, `/content` 진입 시 Next.js client exception (shadcn/radix `<Select.Item value="">`).
- **조치:** 모든 SelectItem value가 빈 문자열이 아니도록 토큰(`__all__`, `__none__`, `__unknown__`) 치환 + 기본값 `""` 금지.
- **적용:** `app/(app)/commands/page.tsx`, `app/(app)/content/page.tsx`, `app/(app)/dashboard/playbooks/[id]/page.tsx`, `app/(app)/dashboard/playbooks/new/page.tsx`.

---

## 1) 라우팅/명칭 정합성 — 완료

- 사용자 라우트: **`/commands`** 유지. 내부 구현은 **command_catalogs** 단일 실체.
- `next.config.ts` redirects: `/command_catalogs`, `/dashboard/library` → `/commands`.
- 메뉴/링크: `dashboard-sidebar`, `AppSideNav`, `mobile-bottom-nav` 모두 `href="/commands"`.
- 빌드 누락 방지: alias만 사용, 폴더/테이블명 이동 없음.

---

## 2) 홈(랜딩) 고정 — 완료

- `/`는 항상 랜딩. `app/page.tsx` → `redirect("/landing")`, `next.config.ts` → `source: '/'` → `destination: '/landing'`.
- 랜딩 페이지에서 “로그인 시 `/dashboard` 리다이렉트” 제거. 로그인 여부와 관계없이 랜딩 표시, CTA “대시보드”로 이동.
- 점검 순서: `docs/qa/landing-vs-dashboard-checklist.md`.

---

## 3) 노드 러너(EXE) 릴리즈 — 완료

- Inno Setup 산출물: `$out/Output/doai-me-app-{ver}-win-x64-installer.exe` (리포명+버전+installer). CI 검사/업로드 경로 일치.
- `OutputBaseFilename`: `doai-me-app-{#MyAppVersion}-win-x64-installer` (setup.exe 미사용).
- 릴리즈 asset: `doai-me-app-*-win-x64-installer.exe`, sha256sums.txt.

---

## 4) CI 실패 원인 제거 — 완료

- **SonarQube:** PR에서만 실행(`build.yml` on pull_request). 릴리즈 워크플로에는 Sonar 없음.
- **pkg:** node18-win-x64 타겟, 릴리즈 job은 Node 18 사용.

---

## 5) 아키텍처 고정 (콜백 방식) — 반영됨

- Web: 등록/분배/상태. 실행: 노드 러너.
- 이벤트: RUN_REQUEST(Web→Runner, pull로 수신) / RUN_EVENT·DEVICE_SNAPSHOT(Runner→Web, callback). 상세: `docs/mvp-contract.md`.

---

## 6) 웹 기능 범위 (Phase A/B/C) — 별도 스프린트

| Phase | 내용 | 비고 |
|-------|------|------|
| **A** | videos/route.ts — keyword 자동 설정(기본=제목), prob_playlist 저장; 등록 시 자동 시청 Job + AI 댓글(GPT-4o-mini) | 추후 구현 |
| **B** | jobs/route.ts + job-distributor.ts — PC별 최대 20대 그룹핑 분배 | 추후 구현 |
| **C** | Worker 자동화(파이썬) — bot_orchestrator.py, youtube_actions.py, constants.py, appium_tasks.py (타임아웃/playlist/skip 등) | 추후 구현 |

---

## 완료 기준 (수용 테스트)

- [ ] **QA Ralph(Playwright):** `/`, `/dashboard`, `/content`, `/commands` 접속 시 client exception 0건, 네트워크 실패 0건(허용 API 예외는 목록화).
- [ ] **GitHub Release:** Windows 설치파일(.exe)이 실제 asset으로 업로드됨(태그만으로 끝나지 않음).
- [ ] **doai.me:** “명령 실행” 클릭 → 노드 러너가 실행 → 웹에서 로그/상태가 준실시간 갱신.

**실행:** `BASE_URL=<url> node scripts/qa-ralph-collect-errors.mjs` 또는 `npm run e2e:acceptance`로 수용 여부 확인.
