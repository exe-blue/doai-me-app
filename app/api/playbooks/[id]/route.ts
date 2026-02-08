/**
 * GET /api/playbooks/:id — get playbook with steps and command_asset summary
 * PATCH /api/playbooks/:id — update name, description, steps (replace)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: playbook, error: pbErr } = await supabase
      .from('playbooks')
      .select('id, name, description, created_at, updated_at')
      .eq('id', id)
      .single();

    if (pbErr || !playbook) {
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
    }

    const { data: steps, error: stepsErr } = await supabase
      .from('playbook_steps')
      .select('id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability, params')
      .eq('playbook_id', id)
      .order('sort_order');

    if (stepsErr) {
      return NextResponse.json({ error: stepsErr.message }, { status: 500 });
    }

    const assetIds = [...new Set((steps ?? []).map((s) => s.command_asset_id))];
    const commandAssets: Record<string, { id: string; title: string; asset_type: string }> = {};
    if (assetIds.length > 0) {
      const { data: assets } = await supabase
        .from('command_assets')
        .select('id, title, asset_type')
        .in('id', assetIds);
      for (const a of assets ?? []) {
        commandAssets[a.id] = { id: a.id, title: a.title, asset_type: a.asset_type ?? 'adb_script' };
      }
    }

    const stepsWithAsset = (steps ?? []).map((s) => ({
      ...s,
      command_asset: commandAssets[s.command_asset_id] ?? null,
    }));

    return NextResponse.json({
      ...playbook,
      steps: stepsWithAsset,
    });
  } catch (err) {
    console.error('[playbooks/:id] GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const body = await req.json();
    const { name, description, steps } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof name === 'string') updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    if (Object.keys(updates).length > 1) {
      const { error: upErr } = await supabase.from('playbooks').update(updates).eq('id', id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    if (Array.isArray(steps)) {
      await supabase.from('playbook_steps').delete().eq('playbook_id', id);

      const stepRows = steps.map((s: Record<string, unknown>, i: number) => ({
        playbook_id: id,
        command_asset_id: s.command_asset_id,
        sort_order: typeof s.sort_order === 'number' ? s.sort_order : i,
        timeout_ms: typeof s.timeout_ms === 'number' ? s.timeout_ms : null,
        on_failure: ['stop', 'continue', 'retry'].includes((s.on_failure as string) ?? '') ? s.on_failure : 'stop',
        retry_count: typeof s.retry_count === 'number' ? Math.max(0, s.retry_count) : 0,
        probability: typeof s.probability === 'number' ? Math.max(0, Math.min(1, s.probability)) : 1,
        params: typeof s.params === 'object' && s.params !== null && !Array.isArray(s.params) ? s.params : {},
      })).filter((r) => r.command_asset_id);

      if (stepRows.length > 0) {
        const { error: stepsErr } = await supabase.from('playbook_steps').insert(stepRows);
        if (stepsErr) {
          return NextResponse.json({ error: stepsErr.message }, { status: 500 });
        }
      }
    }

    const { data: playbook, error: getErr } = await supabase
      .from('playbooks')
      .select('id, name, description, created_at, updated_at')
      .eq('id', id)
      .single();

    if (getErr || !playbook) {
      return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
    }

    const { data: stepData } = await supabase
      .from('playbook_steps')
      .select('id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability, params')
      .eq('playbook_id', id)
      .order('sort_order');

    const assetIds = [...new Set((stepData ?? []).map((s) => s.command_asset_id))];
    const commandAssets: Record<string, { id: string; title: string; asset_type: string }> = {};
    if (assetIds.length > 0) {
      const { data: assets } = await supabase
        .from('command_assets')
        .select('id, title, asset_type')
        .in('id', assetIds);
      for (const a of assets ?? []) {
        commandAssets[a.id] = { id: a.id, title: a.title, asset_type: a.asset_type ?? 'adb_script' };
      }
    }

    const stepsWithAsset = (stepData ?? []).map((s) => ({
      ...s,
      command_asset: commandAssets[s.command_asset_id] ?? null,
    }));

    return NextResponse.json({
      ...playbook,
      steps: stepsWithAsset,
    });
  } catch (err) {
    console.error('[playbooks/:id] PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
