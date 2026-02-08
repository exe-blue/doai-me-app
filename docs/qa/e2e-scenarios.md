# E2E 시나리오 (고정)

> 계약: ONLINE_WINDOW_SEC=30, LEASE_SEC=30, 노드 폴링 1.5s, 모니터 폴링 1.5s 기준.

---

## 1. E2E 시나리오 1개 (정상 경로)

**목표:** Run 생성 → 노드 pull → ADB 실행 → callback → `/runs/[runId]`에서 확인.

| 단계 | 행동 | 확인 |
|------|------|------|
| 1 | 서버에서 Run 생성(playbook + 대상 디바이스가 run_device_states에 있음) | Run 상태 queued/running |
| 2 | 노드 1대 기동(에뮬레이터 1대 연결, 1.5s 폴링) | pull에서 job 1건 수신, `jobs[0].lease.token` 존재 |
| 3 | 노드가 ADB 스텝 실행 후 스크린샷 업로드 | Storage `artifacts/{run_id}/{device_index}/{timestamp}.png` 생성 |
| 4 | 노드가 task_started / run_step_update / artifact_created / task_finished callback 전송 | callback 200 OK, event_id 멱등(재전송 시 duplicate: true) |
| 5 | 브라우저에서 `/runs/[runId]` 열기(폴링 1.5s) | 히트맵 타일이 running → done, 타일 클릭 시 우측에 로그 tail + 마지막 스크린샷 표시 |

**통과 조건:** 위 5단계가 끊기지 않고 한 사이클 완료.

---

## 2. 장애 시나리오 3개 (고정)

### 2.1 중복 pull (노드 2개) — 중복 실행 방지

| 단계 | 행동 | 기대 |
|------|------|------|
| 1 | 동일 run에 대해 노드 A, 노드 B가 거의 동시에 pull(1.5s 이내) | 한 노드만 job 수신, 다른 노드는 `jobs: []` |
| 2 | 동일 (run_id, device_index, step)가 두 노드에 할당되지 않음 | DB에서 해당 run_device_states row는 lease_owner 1개만 존재, 다른 노드가 같은 row를 받지 않음 |

**통과 조건:** 두 노드가 동시에 pull해도 같은 디바이스/스텝이 둘 다에게 할당되지 않음(FOR UPDATE SKIP LOCKED + lease).

---

### 2.2 노드 죽음 — lease 만료 후 재할당

| 단계 | 행동 | 기대 |
|------|------|------|
| 1 | 노드가 job 수신 후 callback 없이 종료(크래시/kill) | 해당 row는 lease_owner/lease_until 유지 |
| 2 | LEASE_SEC(30초) 경과 후 다른 노드(또는 재기동 노드)가 pull | 만료된 row가 후보에 포함되어 다른 노드에 재할당됨 |
| 3 | 새 노드가 동일 step 실행 후 callback | run_device_states/run_steps 정상 갱신 |

**통과 조건:** lease_until < now() 인 row는 다시 후보로 선택되어 재할당됨.

---

### 2.3 늦은 callback — token 불일치 무시

| 단계 | 행동 | 기대 |
|------|------|------|
| 1 | 노드 A가 job 수신(lease_token T1), 실행 후 30초 지나 lease 만료 | lease_until < now() |
| 2 | 노드 B가 pull로 같은 row 수신(lease_token T2), 실행 중 | 해당 row lease_token = T2 |
| 3 | 노드 A가 늦게 task_finished callback 전송(payload에 lease_token T1) | 서버가 T1 ≠ T2로 판단, run_device_states 업데이트하지 않음(로그만 또는 무시) |
| 4 | 노드 B가 정상 callback(T2) 전송 | run_device_states는 B의 결과로만 갱신됨 |

**통과 조건:** lease_token 불일치 callback은 진행 상태를 덮어쓰지 않음.

---

## 3. 테스트 시 기준값

| 항목 | 값 |
|------|-----|
| ONLINE_WINDOW_SEC | 30 |
| LEASE_SEC | 30 |
| 노드 pull 간격 | 1.5s |
| 모니터 폴링 간격 | 1.5s |

이 값 변경 시 시나리오(특히 2.2, 2.3) 타이밍을 맞춰 재검증한다.
