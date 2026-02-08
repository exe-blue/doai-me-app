-- Run-level params for workflow template substitution ({{QUERY}}, {{VIDEO_PICK}}, etc.)
-- Node Agent: before executing steps, merge runs.params + AUTO_SCREENSHOT_PATH and substitute in definition_json strings.

alter table public.runs
  add column if not exists params jsonb default '{}';

comment on column public.runs.params is 'Template params for workflow steps: QUERY, VIDEO_PICK, etc. Substituted at runtime into {{KEY}} in command/params.';
