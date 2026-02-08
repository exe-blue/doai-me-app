# 아키텍처 한 문장 + Phase 범위 (Canonical)

> **tags**: `architecture`, `node`, `web`, `outbound`, `adapters`, `phase-a`, `phase-b`, `phase-c`
> **status**: canonical — 구조·정합성·Phase 범위는 이 문서를 따른다.
> **참조**: `docs/arch/orchestration.md`, `docs/guide/mvp-routes-and-backend.md`

---

## 0) 구조를 한 문장으로 고정

**웹은 직접 로컬 노드에 붙지 않는다.**

대신 **노드 EXE가 서버(doai.me 백엔드)에 ‘상시 연결(Outbound)’**하고, 서버가 노드에게 “명령(작업)”을 내려주면 노드가 로컬 API(벤더/ADB/스크립트/파일/APK)를 실행한 뒤 결과를 서버로 보고한다.

- 웹가 Vercel 등 외부 호스팅이면 내부망/사설망 노드로 직접 호출이 거의 항상 불가 → **노드→서버 outbound만** 허용하는 구조가 가장 안정적.

---

## 1) 노드 EXE가 제공하는 “로컬 API” 범위 — 4개 어댑터

노드 기능은 **어댑터 4개**로만 표현한다. 나머지는 전부 이 조합.

| 어댑터 | 역할 |
|--------|------|
| **(1) Emulator Adapter** | 벤더 기능 API 래핑: 스캔 시작/중지, 디바이스 등록/해제, 디바이스 상태(online/offline, adb 연결 여부), (옵션) 화면 캡처/프리뷰·로그 조회 |
| **(2) ADB Adapter** | `adb devices`, connect/disconnect, apk install/uninstall, 파일 push/pull, 단일 adb 명령 실행 + 타임아웃 + 결과 |
| **(3) Script Adapter** | JS/CMD/JSON 스크립트(멀티라인) 실행, 여러 스크립트 조합(순서·조건부·확률 실행), 표준 출력/에러를 로그 스트림으로 수집 |
| **(4) Asset Adapter** | 파일 업로드(서버→노드), 노드 로컬 캐시/버전 관리, 실행 시 자산 참조(resolve) |

**결론:** “웹에서 내릴 수 있는 모든 명령”은 서버가 Job으로 정의하고, 노드가 받아서 위 4개 어댑터를 통해 실행한다.

---

## 2) 서버(doai.me 백엔드)의 역할 — 작업 오케스트레이션만

서버는 로컬에 직접 실행하지 않는다.

- **등록**: 영상/채널/명령/자산 메타
- **작업 생성**: Job / Run
- **분배**: 노드별 20대 그룹핑 등
- **상태·로그 저장 및 제공**: 준실시간

---

## 3) Phase A / B / C 매핑

### Phase A — 영상 등록 자동화 (웹 백엔드만)

- **A-1** `videos/route.ts`: keyword 자동 설정(기본=영상 제목), `prob_playlist` 저장.
- **A-2** `videos/route.ts`: 영상 등록 시 자동 “시청 Job” 생성, AI 댓글 생성(GPT-4o-mini) 결과를 Job params에 포함 또는 DB 저장.

→ 이 단계에서 “노드 실행”은 없어도 됨. 서버가 Job을 만들어 큐에 넣는 것까지가 목표.

### Phase B — 디바이스 분배 (서버 백엔드만)

- **jobs/route.ts + job-distributor**: “PC(노드)별 최대 20대 그룹핑” 규칙을 서버에서 확정.
- Job에 `target_node_id` + `device_group`(인덱스 0..19 등)까지 박아서 내려줌.

→ 노드는 “내가 받은 그룹만 실행”하면 됨. 서버가 분배 책임(노드는 단순 실행).

### Phase C — Worker 자동화 (노드 실행부)

- **선택:** 기존 파이썬(Appium/Celery) 로직 유지(래핑) vs 노드에서 JS/ADB 조합으로 대체. **MVP 최단거리 = 유지(래핑)**.
- 노드 EXE가 Job 수신 시:
  - (옵션 1) 파이썬 워커를 서브프로세스/로컬 서비스로 호출
  - (옵션 2) Celery/worker는 그대로 두고 노드가 트리거만
- 결과(did_playlist, timeout 등)를 서버로 callback.
- **C-1/C-2**: params에 `prob_playlist`, `DEVICE_TIMEOUT_SEC=1200`, `overall_timeout=20m` 등만 내려주면 됨.

---

## 4) 웹·클라이언트 최소 범위

- **웹 UI**: 명령(라이브러리) 등록/조합, 영상 등록(Phase A), Job/Runs 모니터링(준실시간), 노드/디바이스 online/offline만 표시.
- **노드 EXE(클라이언트)**: 창 없이 데몬(서비스), 필요 시 트레이 아이콘. 서비스로 자동 실행, 상태만 서버로 올리고, 웹에서 내려준 Job만 수행.

---

## 5) 개발 에이전트용 “혼선 방지” 지시문 (복붙용)

```
핵심 목표:
웹(doai.me)은 제어/등록만 하고, 실행은 전부 노드 EXE가 수행한다. 노드 EXE는 로컬(벤더 에뮬레이터/ADB/스크립트/파일/APK)을 “로컬 API 어댑터”로 통합하고, 서버와는 outbound 상시 연결(pull 또는 socket)로 Job을 받아 실행 후 callback으로 보고한다.

정합성 규칙(혼선 방지):
1. 웹이 로컬 노드에 직접 호출하지 않는다(네트워크 변수 제거).
2. 서버는 Job 생성/분배/저장만, 실행은 노드만 한다.
3. 노드 기능은 4개 어댑터로만 표현한다: Emulator/ADB/Script/Asset.
4. 상태는 online/offline로 단순화, 노드당 동시 실행 1개, timeout 후 스킵 기본값 유지.

Phase 구현 범위:
• Phase A: videos/route.ts에서 keyword 자동화 + prob_playlist 저장 + 등록 시 시청 Job 생성 + GPT-4o-mini 댓글 생성 저장/전달
• Phase B: jobs/route.ts + distributor에서 노드별 최대 20대 그룹핑, Job에 target_node_id/device_group 확정
• Phase C: 노드가 Job 수행 시 기존 python worker(orchestrator/appium) 호출로 실행, 10%마다 스킵/20분 타임아웃/playlist 지원/결과 보고 포함
```

---

## 6) 수용 테스트 (에이전트 Playwright 1세트)

사람이 브라우저로 테스트하지 않고, **에이전트가 Playwright로** 다음 1세트를 실행해 “웹→노드→로컬 실행→웹 반영” 완성을 검증한다.

| # | 단계 | 확인 내용 |
|---|------|-----------|
| 1 | `/videos` (또는 URL 등록) | 영상 등록 |
| 2 | 서버 | Job 생성 확인 |
| 3 | `/runs` | 상태가 `queued` → `running` → `done` 변하는지 확인 |
| 4 | `/devices` | online/offline 확인 |
| 5 | Run 상세 | 로그/결과 필드 존재 확인 |

**통과 시:** “웹 → 노드 → 로컬 실행 → 웹 반영”이 완성된 것으로 간주.
