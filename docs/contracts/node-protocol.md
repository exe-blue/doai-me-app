# Node Protocol — Pull & Callback

> 노드↔서버 코어 계약만 정리. 상세 스펙은 [../api/v0.1.md](../api/v0.1.md) §5, [../spec/callback-contract.md](../spec/callback-contract.md) 참고.

---

## 인증

- **Header:** `X-Node-Auth: NODE_SHARED_SECRET`
- 실패: **401 UNAUTHORIZED**

---

## POST /api/nodes/pull

노드가 주기적으로 호출. 서버는 `fn_pull_job` + lease(lease_owner / lease_until / lease_token)로 **원자 할당** 후 job만 반환.

**Request:** `{ "node_id": "PC-01", "max_jobs": 1 }`

**Response 200:** `jobs[]` 각 요소에 `lease.token` 필수. 할당 없으면 `jobs: []` 또는 204.

**429 RATE_LIMITED:** `Retry-After` 헤더로 백오프 힌트.

---

## POST /api/nodes/callback

노드가 step 진행/완료/아티팩트 등 보고. **멱등:** `event_id` 기준으로 이미 처리된 이벤트면 200 + `duplicate: true`.

**lease_token:** payload에 포함. 서버는 현재 lease와 비교해 불일치 시 **상태(run_device_states) 갱신 거부**, 응답 **409 LEASE_MISMATCH**. (로그만 남기거나 무시)

**Response 200:** `{ "ok": true, "duplicate": false|true, "request_id": "uuid" }`  
**Response 409:** `error.code === "LEASE_MISMATCH"`

---

## 요약

| 항목 | 규칙 |
|------|------|
| 할당 | Pull은 원자 할당 결과만 반환, job에 lease.token 필수 |
| 멱등 | callback event_id → 200 duplicate로 재시도 친화 |
| 늦은 콜백 | lease_token 불일치 → 409, 상태 덮어쓰기 없음 |
| Rate limit | 429 + Retry-After |
