/**
 * DoAi.Me MVP — Nodes poll for pending runs (run_start payload for enqueue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyNodeAuth(req: NextRequest): boolean {
  const secret = process.env.NODE_AGENT_SHARED_SECRET;
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const header = token ?? req.headers.get('X-Node-Auth');
  return !!secret && secret === header;
}

export async function GET(req: NextRequest) {
  if (!verifyNodeAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const node_id = req.nextUrl.searchParams.get('node_id');
  if (!node_id) {
    return NextResponse.json({ error: 'node_id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: runs, error } = await supabase
    .from('runs')
    .select(`
      id,
      trigger,
      scope,
      youtube_video_id,
      params,
      timeout_overrides,
      global_timeout_ms,
      stop_requested_at,
      workflow_id,
      playbook_id,
      workflows ( workflow_id )
    `)
    .in('status', ['pending', 'queued'])
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error(`[node_id=${node_id}] Pending runs fetch failed`, error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  const pending: Array<Record<string, unknown>> = [];

  for (const r of runs ?? []) {
    const row = r as Record<string, unknown>;
    const w = Array.isArray(row.workflows) ? row.workflows[0] : row.workflows;
    const workflow_id = (w as Record<string, string>)?.workflow_id ?? null;
    const playbookId = row.playbook_id as string | null | undefined;

    const payload: Record<string, unknown> = {
      run_id: row.id,
      trigger: row.trigger ?? 'manual',
      scope: row.scope ?? 'ALL',
      youtubeVideoId: row.youtube_video_id ?? null,
      params: (row.params as Record<string, unknown>) ?? {},
      timeoutOverrides: (row.timeout_overrides as Record<string, number>) ?? {},
      global_timeout_ms: row.global_timeout_ms ?? null,
      stop_requested_at: row.stop_requested_at ?? null,
    };

    if (playbookId) {
      const { data: playbook } = await supabase
        .from('playbooks')
        .select('id, name')
        .eq('id', playbookId)
        .single();
      const { data: steps } = await supabase
        .from('playbook_steps')
        .select('id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability, params')
        .eq('playbook_id', playbookId)
        .order('sort_order');
      const assetIds = [...new Set((steps ?? []).map((s) => s.command_asset_id))];
      const { data: assets } =
        assetIds.length > 0
          ? await supabase.from('command_assets').select('id, kind').in('id', assetIds)
          : { data: [] };
      const kindByRef: Record<string, string> = {};
      for (const a of assets ?? []) {
        kindByRef[a.id] = a.kind;
      }
      const stepsJson = (steps ?? []).map((s, i) => ({
        id: `step_${i}`,
        ref: s.command_asset_id,
        kind: kindByRef[s.command_asset_id] ?? 'adb',
        sort_order: s.sort_order ?? i,
        timeoutMs: s.timeout_ms ?? 30000,
        onFailure: s.on_failure ?? 'stop',
        retryCount: s.retry_count ?? 0,
        probability: Number(s.probability ?? 1),
        params: (s.params as Record<string, unknown>) ?? {},
      }));
      payload.playbook = {
        version: '1',
        playbook_id: playbookId,
        name: (playbook as { name?: string })?.name ?? 'Playbook',
        defaultStepTimeoutMs: 30000,
        defaultOnFailure: 'stop',
        globalTimeoutMs: row.global_timeout_ms ?? 600000,
        steps: stepsJson,
      };
    } else {
      payload.workflow_id = workflow_id ?? 'login_settings_screenshot_v1';
    }

    pending.push(payload);
  }

  return NextResponse.json({ pending });
}
