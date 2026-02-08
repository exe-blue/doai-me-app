# MVP API/실행 정합성 — 체크 순서 & 계약

> **tags**: `mvp`, `xiaowei`, `node-runner`, `callback`, `command_catalogs`, `acceptance`
> **status**: canonical — 이 스프린트는 “API/실행 정합성”에 집중. UI는 이미 있음.

---

## 핵심 아키텍처 (고정)

- **Web(doai.me):** Job 생성/분배/모니터링 API 제공
- **Node Runner(EXE):** 로컬 실행기 + 상태 콜백
- **로컬 실행:** Xiaowei WebSocket API(에뮬레이터/폰보드)로 통일
  - **WS:** `ws://127.0.0.1:22222/` (미설정 시 Node Runner 기본값)
  - **Request:** `{ action, devices, data }`

---

## Node Runner가 래핑해야 하는 Xiaowei 액션 (최소)

| 구분 | 액션 | 용도 |
|------|------|------|
| 디바이스 스냅샷 | `list` | status로 온라인/오프라인만 사용 |
| 명령 실행 | `adb_shell`, `pointerEvent`, `pushEvent`, `screen` | |
| 파일/APK | `uploadFile`, `pullFile`, `installApk`, `uninstallApk` | |
| 스크립트/배치 | `autojsCreate`, `actionCreate` (v8.288+) | taskInterval/deviceInterval = 확률·조합 실행 기반 |

---

## 노드 부팅 시퀀스 (필수)

1. Xiaowei WS 연결 체크
2. `list`로 디바이스 스냅샷 → 웹에 heartbeat + snapshot 콜백
3. (선택) OTG 스캔 2~3회 트리거 후 다시 `list`로 수량 확인  
   - 수동 예: `adb connect [IP]:5555`  
   - OTG 스캔 기능 정의는 벤더 문서 참고

---

## 품질/정합성 요구사항

- **용어 통일:** 라우트/명칭/폴더는 `command_catalogs` 사용. `commands` 같은 잘못된 이름 재발 방지(URL만 `/commands` alias).
- **SonarQube:** MVP 빌드 파이프라인에서 자동 분석 중복 제거/비활성화 — 우선 빌드 통과.
- **콜백 최소 필드:** `node_id`, `run_id`(job_id), `device_serial`(또는 device_id), `status`, `last_error`(또는 error_message).

---

## 완료 기준 (수용 테스트)

- 웹에서 Job 생성 → distributor가 노드별 20대 chunk 생성 → Node Runner가 chunk 수신
- Node Runner가 `list`로 온라인인 디바이스만 골라 **기기별 순차 실행**
- 실행은 Xiaowei `autojsCreate` 또는 `actionCreate`로 수행
- 실행 로그/완료/실패가 웹에 표시되고, 오프라인/무응답 기기는 **타임아웃 후 스킵**
- 설치: Inno Setup 기반 EXE 설치 가능(창 없음), 재부팅 후 서비스로 자동 실행 가능

---

## 개발 에이전트 “먼저 체크할 순서” (Cursor 5단계)

에이전트가 헷갈리지 않게, **아래 순서만** 확인하면 된다.

| # | 확인 항목 | 판단 |
|---|-----------|------|
| 1 | Node Runner가 로컬에서 Xiaowei WS에 붙는지 | `ws://127.0.0.1:22222/` 연결 성공 |
| 2 | `list` 결과에 온라인 기기가 20대 이상 잡히는지 | list 응답 devices.length ≥ 20 (또는 환경에 맞는 수) |
| 3 | job_chunk 한 개가 들어왔을 때, 기기별로 `autojsCreate`가 실제로 도는지 | pull → job 수신 → 기기별 autojsCreate 호출 |
| 4 | 무응답 기기 스킵 로직이 동작하는지 | timeout 후 다음 기기로 진행 |
| 5 | 웹 콜백이 최소 필드로 찍히는지 | `node_id`, `job_id`(run_id), `device`, `status`, `error` |

---

## 참조

- 벤더 계약: [../spec/vendor-adapter.md](../spec/vendor-adapter.md)
- 콜백 계약: [../spec/callback-contract.md](../spec/callback-contract.md)
- 구조 한 문장 + Phase: [../arch/architecture-single-line-and-phases.md](../arch/architecture-single-line-and-phases.md)
