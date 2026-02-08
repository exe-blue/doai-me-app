-- L0 command_asset: web_run_action (Catalog 참조 실행). payload = { catalog, action, params }
-- Playbook에서 ref로 참조 후 payload에 catalog/action 넣어 실행. 내부는 stub 가능.

insert into public.command_assets (kind, title, description, folder, inline_content, default_timeout_ms)
select
  'js',
  'web_run_action',
  'L0: Run L1 catalog action. Payload: { catalog: string, action: string, params?: object }. Load catalog JSON, run action by id. Stub until Playwright/runner attached.',
  '21_web_youtube_dom',
  '// web_run_action: payload = { catalog, action, params }. Load catalog by catalog_id, run action by id, apply params. Stub.',
  30000
where not exists (
  select 1 from public.command_assets
  where title = 'web_run_action' and folder = '21_web_youtube_dom'
);

-- Ensure asset_type is set if column exists (FRD migration may have added it)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'command_assets' and column_name = 'asset_type'
  ) then
    update public.command_assets
    set asset_type = 'js'
    where title = 'web_run_action' and folder = '21_web_youtube_dom';
  end if;
end $$;
