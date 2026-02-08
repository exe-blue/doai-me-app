-- Seed workflows: bootstrap_only_v1, login_settings_screenshot_v1
-- Step ids align with API timeoutOverrides: PREFLIGHT, BOOTSTRAP, LOGIN_FLOW, SCREENSHOT, UPLOAD

insert into public.workflows (workflow_id, name, version, description, definition_json)
values (
  'bootstrap_only_v1',
  'Bootstrap Only',
  '1.0.0',
  'Device preflight + ADB bootstrap only (no login/screenshot)',
  '{
    "steps": [
      { "id": "PREFLIGHT", "kind": "adb", "command": "devices", "timeoutMs": 20000, "onFailure": "stop" },
      { "id": "BOOTSTRAP", "kind": "adb", "command": "settings put global window_animation_scale 0", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "BOOTSTRAP_STAY_AWAKE", "kind": "adb", "command": "settings put global stay_on_while_plugged_in 7", "timeoutMs": 5000, "onFailure": "continue" }
    ],
    "defaultStepTimeoutMs": 30000,
    "defaultOnFailure": "stop"
  }'::jsonb
)
on conflict (workflow_id) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  definition_json = excluded.definition_json;

insert into public.workflows (workflow_id, name, version, description, definition_json)
values (
  'login_settings_screenshot_v1',
  'Login → Settings → Screenshot',
  '1.0.0',
  'Full pipeline: Preflight → Bootstrap → LoginFlow → Vendor Screenshot → Upload',
  '{
    "steps": [
      { "id": "PREFLIGHT", "kind": "adb", "command": "devices", "timeoutMs": 20000, "onFailure": "stop" },
      { "id": "BOOTSTRAP", "kind": "adb", "command": "settings put global window_animation_scale 0", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "BOOTSTRAP_STAY_AWAKE", "kind": "adb", "command": "settings put global stay_on_while_plugged_in 7", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "LOGIN_FLOW", "kind": "vendor", "action": "login", "timeoutMs": 120000, "onFailure": "stop" },
      { "id": "SCREENSHOT", "kind": "vendor", "action": "screen", "timeoutMs": 30000, "onFailure": "retry", "retryCount": 1 },
      { "id": "UPLOAD", "kind": "upload", "source": "screenshot", "timeoutMs": 60000, "onFailure": "retry", "retryCount": 2 }
    ],
    "defaultStepTimeoutMs": 30000,
    "defaultOnFailure": "stop"
  }'::jsonb
)
on conflict (workflow_id) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  definition_json = excluded.definition_json;
