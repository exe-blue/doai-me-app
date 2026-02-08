# v0.dev UI 통합 가이드 (Canonical)

> **tags**: `v0`, `ui`, `integration`, `landing`, `frontend`, `cta`, `glossary`
> **sources**: v0-Integration-Instructions, landing-command-template
> **status**: canonical — v0 코드 통합 시 이 가이드를 따른다

---

## 원칙

- v0 코드를 **재설계하지 말고** 기존 레포 구조에 **흡수**
- DoAi.Me 용어/IA/가드레일과 API 계약 기준으로 조정

---

## 통합 절차

1. PR 브랜치: `chore/v0-ui-import`
2. v0 코드를 기존 `app/` 구조에 배치
3. Vercel 빌드 통과 확인
4. Next.js App Router 사용 (pages router 혼재 금지)

---

## DoAi.Me 용어 (Glossary)

| 한글 | 영문 | 설명 |
|------|------|------|
| 기기 | Device | 물리 Android 디바이스 |
| 호스트 | Node | PC-01~04 |
| 의식 실행 | Run | 워크플로우 실행 인스턴스 |
| 기록 보관소 | Artifacts | 스크린샷/결과물 |

---

## 필수 페이지

| 경로 | 용도 |
|------|------|
| /dashboard | 메인 대시보드 |
| /dashboard/devices | 기기 목록 (Online/Offline) |
| /dashboard/videos | 비디오 목록 |
| /dashboard/runs | 의식 실행 목록 |
| /dashboard/artifacts | 기록 보관소 |
| /dashboard/onboarding | 온보딩 |
| /dashboard/settings | 설정 |

---

## 가드레일

- Frontend는 `service_role` 키 **절대 사용 금지**; 모든 쓰기는 backend API
- Run create 폼: per-action timeout overrides + bounds 검증 (5s~10m)
- Backend: Callback Contract 준수 → [../spec/callback-contract.md](../spec/callback-contract.md)
- 없는 기능은 stub 페이지로 처리

---

## 랜딩 CTA 구조

| 링크 | 대상 |
|------|------|
| Dashboard | /dashboard |
| Runs | /dashboard/runs |
| Devices | /dashboard/devices |
| Artifacts | /dashboard/artifacts |
| Settings | /dashboard/settings |
| Health | /health |
| Workflows | /dashboard/workflows (stub) |

상태 카드 (초기 더미 데이터): Runs today, Active nodes/devices, Recent failure

---

## PR 산출물

- 빌드 통과
- `.env.example` (시크릿 없음)
- 로컬 개발 README 갱신

---

## 관련 문서

- API: [../spec/api-contracts.md](../spec/api-contracts.md)
- 배포: [deploy.md](deploy.md)
- 오케스트레이션: [../arch/orchestration.md](../arch/orchestration.md)