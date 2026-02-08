# Security & Setup Checklist

> **CRITICAL**: .env에 Service Role Key, Shared Secret, YouTube 키가 노출되면 바로 키 회전(rotate) 후 새 값으로 교체하라. 프론트에 노출되면 보안 사고 위험.

---

## 키 회전 (즉시 권장)

| 키 | 노출 시 조치 |
|----|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role 키 재생성 |
| `NODE_AGENT_SHARED_SECRET` | `openssl rand -hex 32`로 새 값 생성 → Vercel + 모든 노드 PC .env 업데이트 |
| `YOUTUBE_API_KEY` | Google Cloud Console → API Keys → 새 키 생성 → 기존 키 비활성화 |

**주의**: .env, .env.local은 반드시 .gitignore에 포함. 커밋 금지.

---

## 노드 4대 기준 세팅 (PC-01~PC-04)

### 각 PC별

| 항목 | 내용 |
|------|------|
| .env | 각 PC 로컬에 1개 (`파일명: .env`) |
| NODE_ID | PC-01, PC-02, PC-03, PC-04 순으로 PC별로 다르게 설정 |
| 나머지 | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NODE_AGENT_SHARED_SECRET, VENDOR_WS_URL, BACKEND_URL 동일 |

### Backend

| 항목 | 내용 |
|------|------|
| 콜백 엔드포인트 | POST /api/nodes/callbacks (node_heartbeat, run_started, task_*, run_finished 수신) |
| WS 컨트롤 채널 | 노드→서버 WebSocket; 서버가 run_start 이벤트 전송 |
| Security | 노출된 키 회전 완료 후 배포 |
