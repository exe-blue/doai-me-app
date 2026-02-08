# 환경설정 가이드 (Canonical)

> **tags**: `setup`, `env`, `supabase`, `node-agent`, `secret`, `key-rotation`, `security`
> **sources**: MVP_SETUP_CHECKLIST, Security-and-Setup-Checklist, KEY-ROTATION-ACTIONS
> **status**: canonical — 환경 구성·보안·키 회전은 이 문서를 따른다

---

## 1. Node PC 요구사항

| 항목 | 설명 |
|------|------|
| Vendor tool | `ws://127.0.0.1:22222` 노출 필수 |
| 디바이스 | OTG 약 100대/노드 |
| 동시성 | 글로벌 20 슬롯, 디바이스별 FIFO |
| Accessibility | ADB bootstrap; 실패 시 수동 |

검증: vendor tool → `action=list` → 디바이스 반환 확인

---

## 2. Supabase

| 항목 | 값 |
|------|-----|
| Storage 버킷 | `artifacts` |
| 경로 | `{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png` |
| Key 제한 | `service_role` = Node Agent 전용. 프론트엔드 금지 |
| 마이그레이션 | `supabase db push` 또는 Dashboard SQL Editor |

주요 테이블: videos, workflows, runs, device_tasks, artifacts, command_assets, playbooks

---

## 3. 환경변수

### Backend (.env / .env.local)

| 변수 | 용도 |
|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NODE_AGENT_SHARED_SECRET` | Backend↔Node 인증 |
| `YOUTUBE_API_KEY` | (선택) YouTube Data API |

### Node Agent (node-agent/.env)

| 변수 | 용도 |
|------|------|
| `NODE_ID` | `PC-01` ~ `PC-04` (노드별 고유) |
| `SUPABASE_URL` | 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 |
| `NODE_AGENT_SHARED_SECRET` | 동일 (Backend와 일치) |
| `VENDOR_WS_URL` | `ws://127.0.0.1:22222` |
| `BACKEND_URL` | `https://doai.me` |
| `EMULATOR_AVD` | (선택) AVD 이름 |
| `EMULATOR_GATE_WAIT_MS` | (선택) Gate 안정화 대기 ms |

---

## 4. Vercel 환경변수

Vercel Dashboard → Project → Settings → Environment Variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_AGENT_SHARED_SECRET`

---

## 5. 키 회전 절차

### NODE_AGENT_SHARED_SECRET

1. `openssl rand -hex 32`로 새 값 생성
2. `.env`, `.env.local`, `node-agent/.env` 모두 교체
3. Vercel 환경변수 업데이트
4. PC-01~04 노드의 `node-agent/.env`에도 동일 값 반영
5. 재배포

### SUPABASE_SERVICE_ROLE_KEY

1. Supabase Dashboard → Settings → API → Regenerate
2. `.env`, `.env.local`, `node-agent/.env` 교체

### YOUTUBE_API_KEY

1. Google Cloud Console → Credentials → 기존 키 삭제/제한 → 새 키 생성
2. `.env`, `.env.local` 교체

**중요**: `.env` 파일은 절대 커밋하지 않는다.

---

## 6. YouTube 폴링

| 옵션 | 방법 |
|------|------|
| channelId | `channels.list` → uploads playlist ID |
| uploads playlist | `UU` + channel ID로 `playlistItems.list` |

권장: uploads playlist, 5분 주기

---

## 관련 문서

- API: [../spec/api-contracts.md](../spec/api-contracts.md)
- 오케스트레이션: [../arch/orchestration.md](../arch/orchestration.md)
- 벤더: [../spec/vendor-adapter.md](../spec/vendor-adapter.md)