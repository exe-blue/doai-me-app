# Phase A: Emulator Health Gate + 2-layer Preflight — QA 검증 리포트

> 검증 일자: 계획 실행 후. 체크리스트 및 빌드/코드 검증 결과.

---

## 1. 빌드 검증

| 항목 | 명령 | 결과 |
|------|------|------|
| Next.js | `npm run build` | ✅ 성공 (ESLint 경고 3건: runs/page.tsx 미사용 변수) |
| Node Agent | `cd node-agent && npm run build` | ✅ 성공 |

---

## 2. Phase A 수용 기준 체크리스트

| # | 기준 | 검증 방법 | 결과 |
|---|------|-----------|------|
| 1 | **Emulator Health Gate** 구현: 에뮬레이터 프로세스·ADB online·부팅 완료 확인; 미통과 시 자동 기동/재기동(선택) | `node-agent/src/emulatorGate.ts` 존재, `emulatorHealthGate()` — `isAdbOnline`, `isBootCompleted`, `tryStartAndWait` (EMULATOR_AVD) | ✅ |
| 2 | **Node Preflight** 유지·보강: 벤더 WS 22222 + action=list 성공 시 노드 상태로 heartbeat 보고 | `index.ts`: `sendHeartbeat(vendor_ws_ok, devicesCount)`, 30s 주기 + 기동 시 1회; `type: 'node_heartbeat'`, `payload.vendor_ws_ok` | ✅ |
| 3 | **Device Preflight** 유지: 매 run 직전, unauthorized → needs_usb_authorization fail-fast; offline/missing → 해당 failure_reason | `preflight.ts` 변경 없음. `workflowRunner.ts`에서 Gate 통과 후 `devicePreflight(runtime_handle)` 호출 | ✅ |
| 4 | 실행 순서: Emulator Health Gate → Device Preflight → 워크플로우 스텝. Node Preflight는 주기/부팅 시 별도 | `workflowRunner.ts` 85행 Gate → 100행 Device Preflight → 이후 BOOTSTRAP 등. Node Preflight는 `index.ts` 주기/기동 시 | ✅ |
| 5 | 문서: Preflight 2계층 + Emulator Gate 구조, API/CLI run 생성 명시 | `docs/Workflow-Recipe-DSL-v1-QA.md`: "3중 문지기", "0. Emulator Health Gate", "UI가 늦으면 API/CLI로 run 생성", failure_reason에 emulator_not_* | ✅ |

---

## 3. 코드 레벨 검증

| 검증 항목 | 위치 | 결과 |
|-----------|------|------|
| GET /api/nodes가 vendor_ws_ok 노출 | `app/api/nodes/route.ts` | ✅ `p.vendor_ws_ok`, status = degraded when false |
| callback node_heartbeat 핸들러 | `app/api/nodes/callback/route.ts` | ✅ `node_heartbeat` 시 payload upsert to node_heartbeats |
| Gate 실패 시 task_finished 전송 | `workflowRunner.ts` 86–97행 | ✅ failure_reason: gate.failure_reason |
| .env.example Emulator 옵션 | `node-agent/.env.example` | ✅ EMULATOR_AVD, EMULATOR_GATE_WAIT_MS 주석 |

---

## 4. 로컬 런타임 검증 (수동)

다음은 환경이 갖춰져 있을 때 수동으로 확인하는 항목이다.

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 벤더 WS 미기동 → Node Agent 기동 | Node Preflight 실패 → heartbeat에 vendor_ws_ok: false 반영 → GET /api/nodes에서 해당 노드 status: degraded |
| 2 | 에뮬레이터 종료 상태에서 run 시작 | Emulator Health Gate 실패 → task_finished(failure_reason: emulator_not_online 또는 emulator_not_booted) |
| 3 | ADB unauthorized 디바이스에서 run | Device Preflight에서 needs_usb_authorization 즉시 반환 |

---

## 5. 결론

- **체크리스트**: 5/5 통과.
- **빌드**: Next.js·Node Agent 모두 성공. (Next.js ESLint 경고 3건은 runs 페이지 미사용 변수로, Phase A와 무관.)
- **권장**: 로컬에서 벤더 WS/에뮬레이터/ADB 조건을 바꿔가며 위 수동 시나리오 1~3 확인 시, Phase A 동작 최종 확정 가능.
