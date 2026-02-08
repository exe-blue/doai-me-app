-- Onboarding ADB presets A/B/C/D: command_assets + playbooks
-- A: 속도/안정화 (애니메이션 끄기 + 화면 유지)
-- B: 기본 입력 (깨우기/홈/잠금해제)
-- C: YouTube 테스트 (간단)
-- D: 진단 (get-state, battery, screenshot)

-- 1. Command assets (folder=onboarding, title=slug for join)
insert into public.command_assets (kind, title, folder, inline_content, default_timeout_ms)
values
  ('adb', 'onboarding_a_win', 'onboarding', 'adb shell settings put global window_animation_scale 0', 5000),
  ('adb', 'onboarding_a_trans', 'onboarding', 'adb shell settings put global transition_animation_scale 0', 5000),
  ('adb', 'onboarding_a_anim', 'onboarding', 'adb shell settings put global animator_duration_scale 0', 5000),
  ('adb', 'onboarding_a_stay_awake', 'onboarding', 'adb shell settings put system screen_off_timeout 2147483647', 5000),
  ('adb', 'onboarding_b_wakeup', 'onboarding', 'adb shell input keyevent KEYCODE_WAKEUP', 3000),
  ('adb', 'onboarding_b_home', 'onboarding', 'adb shell input keyevent KEYCODE_HOME', 2000),
  ('adb', 'onboarding_b_swipe_unlock', 'onboarding', 'adb shell input swipe 300 1000 300 500 200', 2000),
  ('adb', 'onboarding_c_youtube_open', 'onboarding', 'adb shell am start -a android.intent.action.VIEW -d "https://www.youtube.com"', 5000),
  ('adb', 'onboarding_c_sleep_10', 'onboarding', 'sleep 10', 12000),
  ('adb', 'onboarding_d_getstate', 'onboarding', 'adb get-state', 3000),
  ('adb', 'onboarding_d_battery', 'onboarding', 'adb shell dumpsys battery | head -5', 5000),
  ('adb', 'onboarding_d_screenshot', 'onboarding', 'adb exec-out screencap -p > /tmp/onboarding_cap.png', 5000)
;

-- 2. Playbooks (names for UI) — idempotent: only if not exists
insert into public.playbooks (name, description)
select v.name, v.desc
from (values
  ('온보딩 프리셋 A - 속도/안정화', '애니메이션 끄기 + 화면 유지'),
  ('온보딩 프리셋 B - 기본 입력', '깨우기 / 홈 / 잠금해제'),
  ('온보딩 프리셋 C - YouTube 테스트', '유튜브 실행 → 10초 대기'),
  ('온보딩 프리셋 D - 진단', 'get-state, battery, screenshot')
) as v(name, desc)
where not exists (select 1 from public.playbooks p where p.name = v.name);

-- 3. Playbook steps (link by name and asset title)
insert into public.playbook_steps (playbook_id, command_asset_id, sort_order)
select p.id, c.id, s.ord
from (
  values
    ('온보딩 프리셋 A - 속도/안정화', 1, 'onboarding_a_win'),
    ('온보딩 프리셋 A - 속도/안정화', 2, 'onboarding_a_trans'),
    ('온보딩 프리셋 A - 속도/안정화', 3, 'onboarding_a_anim'),
    ('온보딩 프리셋 A - 속도/안정화', 4, 'onboarding_a_stay_awake'),
    ('온보딩 프리셋 B - 기본 입력', 1, 'onboarding_b_wakeup'),
    ('온보딩 프리셋 B - 기본 입력', 2, 'onboarding_b_home'),
    ('온보딩 프리셋 B - 기본 입력', 3, 'onboarding_b_swipe_unlock'),
    ('온보딩 프리셋 C - YouTube 테스트', 1, 'onboarding_c_youtube_open'),
    ('온보딩 프리셋 C - YouTube 테스트', 2, 'onboarding_c_sleep_10'),
    ('온보딩 프리셋 D - 진단', 1, 'onboarding_d_getstate'),
    ('온보딩 프리셋 D - 진단', 2, 'onboarding_d_battery'),
    ('온보딩 프리셋 D - 진단', 3, 'onboarding_d_screenshot')
) as s(pname, ord, ctitle)
join public.playbooks p on p.name = s.pname
join public.command_assets c on c.title = s.ctitle and c.folder = 'onboarding'
where not exists (
  select 1 from public.playbook_steps ps where ps.playbook_id = p.id and ps.sort_order = s.ord
);
