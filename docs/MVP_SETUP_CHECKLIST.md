# MVP Setup Checklist — Node Agent + Backend + Supabase

> **Goal**: Today MVP setup, no UI work. Prepare Node Agent env, Backend env, Supabase schema.

---

## 1) Node PC Requirements

| Task | Status | Notes |
|------|--------|-------|
| Vendor tool running, exposes WS at `ws://127.0.0.1:22222` | ⬜ | Vendor SDK/CLI must be running before Node Agent starts |
| Connect ~100 Android devices via OTG (per node) | ⬜ | Physical setup on Node PC |
| Concurrency: 20 devices per node | ⬜ | Global scheduler fills 20 slots; round-robin across device queues |
| Vendor `list` command shows all connected devices | ⬜ | Sanity check: `vendor list` or equivalent |
| Enable accessibility input on each device (ID/PW/button) | ⬜ | ADB bootstrap; manual fallback if adb fails |

**Validation**: Run vendor tool → `list` returns devices → accessibility service enabled (adb or manual).

**Device-dedicated queues**: Each device has its own FIFO queue; never concurrent on same device.

---

## 2) Supabase

| Task | Status | Notes |
|------|--------|-------|
| Create Storage bucket `artifacts` | ✅ | Run `supabase db push` |
| Apply schema: videos, runs, device_tasks, artifacts | ✅ | `supabase/migrations/20250208000000_mvp_schema.sql` |
| Path convention: `{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png` | ⬜ | DoAi.Me Orchestration v1 |
| Use `service_role` key for Node Agent writes only | ⬜ | Never expose in frontend |

**Path convention (Orchestration v1)**: `{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png`

**Path example**: `dQw4w9WgXcQ/node-A1/ABC123/run-uuid/1739012345.png`

**Tables**:
- `videos` — youtubeVideoId (unique)
- `workflows` — 명령 레시피 (workflow_id, name, version, definition_json)
- `runs` — one per job; workflow_id 참조; timeout_overrides, global_timeout_ms
- `device_tasks` — one per device per run; node_id, requires_manual_accessibility
- `artifacts` — screenshot metadata; files in `artifacts` bucket

**노드 .env**: 각 PC마다 `.env` 하나 (커밋 금지). `NODE_ID=PC-01` 등 노드별로 변경.

---

## 3) Secrets

| Task | Status | Notes |
|------|--------|-------|
| Generate `NODE_AGENT_SHARED_SECRET` | ✅ | `openssl rand -hex 32` |
| Set in Vercel: Project → Settings → Environment Variables | ⬜ | Same value for backend auth |
| Set in Node Agent: `node-agent/.env` | ✅ | Same value as Vercel |

**Validation**: Both envs have the same secret; Node Agent sends it in headers when calling backend.

---

## 4) YouTube

| Task | Status | Notes |
|------|--------|-------|
| Decide watch target | ⬜ | `channelId` or `uploads` playlistId |
| Polling interval: 3–5 min (MVP) | ⬜ | Recommended: 5 min |

**Options**:
- **channelId**: Use YouTube Data API `channels.list` → `upload` playlist ID.
- **uploads playlistId**: Direct `playlistItems.list` on `UU...` (uploads) or custom playlist.

**Recommendation for MVP**: Use channel `uploads` playlist (`UU` + channel ID) with 5‑min polling.

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/migrations/20250208000000_mvp_schema.sql` | Schema + artifacts bucket |
| `.env.example` | Backend (Vercel) env template |
| `node-agent/.env.example` | Node Agent env template |
