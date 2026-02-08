# v0.dev UI 통합 규칙

> v0에서 다운받은 코드를 레포에 통합할 때 따른다.

## 전제
- v0 코드를 **재설계하지 말고** 기존 레포 구조에 **흡수**한다.
- DoAi.Me **용어/IA/가드레일**과 **API 계약**을 기준으로 컴포넌트/페이지를 맞춘다.

## 지시문
자세한 지시 템플릿: `docs/v0-Integration-Instructions.md`

## 핵심
1. `/frontend` 또는 `/apps/web`에 배치; Vercel 빌드 OK
2. DoAi.Me glossary: 기기/호스트/의식 실행/기록 보관소, 상태칩
3. 최소 페이지: /dashboard, /dashboard/devices, /dashboard/videos, /dashboard/runs, /dashboard/artifacts, /dashboard/onboarding, /dashboard/settings
4. Frontend는 service_role 키 **절대 사용 금지**; 모든 쓰기는 backend API
5. Run create 폼: per-action timeout overrides + bounds 검증
6. Backend: Callback Contract v1 준수
7. Next.js app router 기준; pages router 혼재 금지
