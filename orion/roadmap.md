# Roadmap

> 프로젝트의 중장기 방향성과 마일스톤을 정의합니다.

## 현재 상태

**Phase:** 모니터링 체계 구축
**Version:** 0.1.0-alpha

---

## Milestones

### ✅ M1: 레포 구조 정리
- [x] apps/ 구조 확립 (web, orchestrator, node-runner)
  - [x] node-runner/ → apps/node-runner/ 이동 완료
  - [x] website/ 중복 제거, apps/website/ 통합
  - [x] 빈 gateway/ 제거
- [x] infra/ 배포 스크립트 정리
  - [x] kong/ → infra/kong/ 통합
- [x] orion/ 운영 문서 체계화
- [x] 미사용 코드 제거
  - archive/ 유지 (deprecated 코드 참조용)
  - local/ 유지 (개발 환경용)
  - sdk/ 유지 (Laixi 문서)

### ✅ M2: 배포 파이프라인 안정화
- [x] CI/CD 파이프라인 정비
  - [x] Ruff linter 설정 업데이트 (lint.* 포맷)
  - [x] Black formatter 통합
  - [x] Per-file-ignores 설정 (tests, scripts, archive)
- [x] 자동 테스트 커버리지 확보
  - [x] 446 unit tests 통과
  - [x] CI 환경용 더미 환경변수 설정
  - [x] Integration test skip 로직 추가
- [ ] 롤백 자동화 (백로그로 이동)

### 🎯 M3: 모니터링 체계 구축 (Current)
- [ ] 로그 수집/분석 파이프라인
- [ ] 알람 체계 구축
- [ ] 대시보드 구성

### 🎯 M4: 스케일링 준비
- [ ] 노드 20대 → 100대 확장 테스트
- [ ] 데이터베이스 최적화
- [ ] 캐싱 레이어 도입

---

## Backlog (우선순위 미정)

- Laixi SDK 고도화
- 페르소나 시스템 v2
- A/B 테스트 프레임워크
- 비용 최적화 분석

---

## 완료된 항목

### 페르소나 시스템 P1 + P2
- [x] P1: IDLE 상태 검색 및 고유성 형성 시스템
  - [x] DB 스키마 확장 (persona_activity_logs.search_keyword, formative_impact)
  - [x] OpenAI 기반 성격 맞춤 검색어 생성
  - [x] Formative Period Effect 계산
- [x] P2: 페르소나 CRUD 및 Laixi 연동
  - [x] 페르소나 CRUD API (GET, POST, PUT, DELETE)
  - [x] Laixi 연동 YouTube 검색 실행
  - [x] 성격 변화 분석 (personality_drift)
  - [x] 검색 기반 관심사 자동 업데이트

---

## 변경 이력

| 날짜 | 변경 내용 | 결정자 |
|------|-----------|--------|
| 2026-01-04 | 초기 로드맵 작성 | @orion |

