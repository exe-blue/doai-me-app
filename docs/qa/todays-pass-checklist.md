# 오늘의 통과 조건 (체크리스트)

배포/머지 전에 아래를 한 번씩 확인한다. 수동으로 진행해도 되고, 시나리오 문서와 함께 사용한다.

---

## 1. E2E 1사이클

- [ ] Run 생성(playbook + 대상 디바이스) 성공
- [ ] 노드 pull → job 1건 수신(`lease.token` 포함)
- [ ] ADB 실행 → 스크린샷 업로드 → callback(task_started / run_step_update / artifact_created / task_finished) 200 OK
- [ ] `/runs/[runId]`에서 해당 디바이스 타일 running → done, 타일 클릭 시 로그 + 스크린샷 표시

---

## 2. 장애 시나리오(선택, 변경 시 필수)

- [ ] **중복 pull:** 노드 2개 동시 pull 시 같은 디바이스/스텝이 둘 다에게 할당되지 않음
- [ ] **노드 죽음:** job 수신 후 노드 종료 → 30초(LEASE_SEC) 후 다른 pull에서 해당 row 재할당됨
- [ ] **늦은 callback:** lease_token 불일치 callback은 run_device_states 갱신하지 않음(로그만)

---

## 3. 관측/계약

- [ ] API 응답에 `X-Request-Id` 헤더 존재(예: `/api/health`, `/api/nodes/pull`)
- [ ] Sentry에 서버/클라이언트 오류 전송됨(필요 시 샘플 오류로 확인)
- [ ] NODE_AGENT_SHARED_SECRET, SUPABASE_SERVICE_ROLE_KEY 클라이언트 노출 없음

---

## 4. 기준값(변경 시 시나리오 재검증)

- ONLINE_WINDOW_SEC=30, LEASE_SEC=30
- 노드 폴링 1.5s, 모니터 폴링 1.5s

---

버그 발생 시 `docs/qa/bug-report-template.md` 로 제보.
