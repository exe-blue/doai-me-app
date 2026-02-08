# Supabase Setup

## Apply migration

**Option A: Supabase CLI (local)**

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

**Option B: Supabase Dashboard**

1. SQL Editor → New query
2. Paste contents of `migrations/20250208000000_mvp_schema.sql`
3. Run

**Option C: Supabase Management API**

Use Supabase dashboard or management API if CLI is not available.

## Tables

| Table        | Purpose                                      |
|-------------|-----------------------------------------------|
| `videos`    | YouTube video metadata (`youtube_video_id` unique) |
| `workflows` | 명령 레시피 (definition_json DSL)             |
| `runs`      | One per job; workflow_id, timeout_overrides   |
| `device_tasks` | One per device per run; node_id, requires_manual_accessibility |
| `artifacts` | Screenshot records (`storage_path`)           |

## Storage

- Bucket: `artifacts`
- Path: `{youtubeVideoId}/{node_id}/{device_serial}/{run_id}/{timestamp}.png`
- Access: `service_role` only (never in frontend)
