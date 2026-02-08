-- Seed: demo_20steps_v1 — YouTube launch → search → play 10s → comments → like → screenshot → upload
-- paramsSchema: QUERY, VIDEO_PICK. Run 생성 시 params 주입. {{QUERY}}, {{VIDEO_PICK}}, {{AUTO_SCREENSHOT_PATH}} 치환.

insert into public.workflows (workflow_id, name, version, description, definition_json)
values (
  'demo_20steps_v1',
  'Demo 20+ Steps (YouTube)',
  'v1',
  'YouTube: launch → search → play 10s → comments scroll → like-if-needed → screenshot → upload',
  '{
    "defaultStepTimeoutMs": 30000,
    "defaultOnFailure": "stop",
    "globalTimeoutMs": 600000,
    "paramsSchema": {
      "QUERY": { "type": "string", "default": "sleep music" },
      "VIDEO_PICK": { "type": "string", "default": "first_result" }
    },
    "steps": [
      { "id": "preflight-node-vendor-list", "kind": "vendor", "action": "list", "timeoutMs": 5000, "onFailure": "stop" },
      { "id": "adb-wake", "kind": "adb", "command": "input keyevent KEYCODE_WAKEUP", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "adb-home", "kind": "adb", "command": "input keyevent KEYCODE_HOME", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "adb-unlock-swipe", "kind": "adb", "command": "input swipe 500 1600 500 400 300", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "launch-youtube", "kind": "vendor", "action": "launch", "params": { "package": "com.google.android.youtube" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 2 },
      { "id": "wait-youtube-ready", "kind": "assert", "check": "ui_present", "params": { "selector": "YOUTUBE_HOME_READY" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 1 },
      { "id": "open-search", "kind": "js", "script": "autojsCreate", "params": { "id": "yt_open_search", "selector": "YOUTUBE_SEARCH_BUTTON" }, "timeoutMs": 15000, "onFailure": "retry", "retryCount": 1 },
      { "id": "type-query", "kind": "adb", "command": "input text \"{{QUERY}}\"", "timeoutMs": 8000, "onFailure": "retry", "retryCount": 1 },
      { "id": "submit-search", "kind": "adb", "command": "input keyevent KEYCODE_ENTER", "timeoutMs": 8000, "onFailure": "retry", "retryCount": 1 },
      { "id": "wait-search-results", "kind": "assert", "check": "ui_present", "params": { "selector": "YOUTUBE_SEARCH_RESULTS_READY" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 1 },
      { "id": "select-video", "kind": "js", "script": "autojsCreate", "params": { "id": "yt_select_video", "strategy": "{{VIDEO_PICK}}" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 2 },
      { "id": "wait-player", "kind": "assert", "check": "ui_present", "params": { "selector": "YOUTUBE_PLAYER_READY" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 2 },
      { "id": "watch-10s", "kind": "sleep", "ms": 10000, "timeoutMs": 12000, "onFailure": "continue" },
      { "id": "open-comments", "kind": "js", "script": "autojsCreate", "params": { "id": "yt_open_comments", "selector": "YOUTUBE_COMMENTS_ENTRY" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 2 },
      { "id": "wait-comments", "kind": "assert", "check": "ui_present", "params": { "selector": "YOUTUBE_COMMENTS_READY" }, "timeoutMs": 20000, "onFailure": "retry", "retryCount": 2 },
      { "id": "scroll-1", "kind": "adb", "command": "input swipe 500 1500 500 500 250", "timeoutMs": 6000, "onFailure": "continue" },
      { "id": "scroll-2", "kind": "adb", "command": "input swipe 500 1500 500 500 250", "timeoutMs": 6000, "onFailure": "continue" },
      { "id": "scroll-3", "kind": "adb", "command": "input swipe 500 1500 500 500 250", "timeoutMs": 6000, "onFailure": "continue" },
      { "id": "scroll-4", "kind": "adb", "command": "input swipe 500 1500 500 500 250", "timeoutMs": 6000, "onFailure": "continue" },
      { "id": "scroll-5", "kind": "adb", "command": "input swipe 500 1500 500 500 250", "timeoutMs": 6000, "onFailure": "continue" },
      { "id": "back-from-comments", "kind": "adb", "command": "input keyevent KEYCODE_BACK", "timeoutMs": 5000, "onFailure": "continue" },
      { "id": "like-if-needed", "kind": "js", "script": "autojsCreate", "params": { "id": "yt_like_if_needed", "likeSelector": "YOUTUBE_LIKE_BUTTON" }, "timeoutMs": 15000, "onFailure": "retry", "retryCount": 1 },
      { "id": "screenshot", "kind": "vendor", "action": "screen", "params": { "savePath": "{{AUTO_SCREENSHOT_PATH}}" }, "timeoutMs": 15000, "onFailure": "retry", "retryCount": 1 },
      { "id": "upload-screenshot", "kind": "upload", "source": "screenshot", "timeoutMs": 45000, "onFailure": "retry", "retryCount": 2 },
      { "id": "exit-to-home", "kind": "adb", "command": "input keyevent KEYCODE_HOME", "timeoutMs": 5000, "onFailure": "continue" }
    ]
  }'::jsonb
)
on conflict (workflow_id) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  definition_json = excluded.definition_json;
