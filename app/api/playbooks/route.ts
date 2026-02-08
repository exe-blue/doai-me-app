/**
 * GET /api/playbooks — list playbooks
 * POST /api/playbooks — create playbook with steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: items, error } = await supabase
      .from('playbooks')
      .select('id, name, description, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: items ?? [] });
  } catch (err) {
    console.error('[playbooks] GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description = null, steps = [] } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: playbook, error: pbErr } = await supabase
      .from('playbooks')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, description, created_at')
      .single();

    if (pbErr || !playbook) {
      console.error('[playbooks] Insert failed', pbErr);
      return NextResponse.json({ error: pbErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    const playbookId = playbook.id;
    const stepsPayload = Array.isArray(steps) ? steps : [];
    const stepRows = stepsPayload.map(
      (s: Record<string, unknown>, i: number) => ({
        playbook_id: playbookId,
        command_asset_id: s.command_asset_id,
        sort_order: typeof s.sort_order === 'number' ? s.sort_order : i,
        timeout_ms: typeof s.timeout_ms === 'number' ? s.timeout_ms : null,
        on_failure: ['stop', 'continue', 'retry'].includes((s.on_failure as string) ?? '') ? s.on_failure : 'stop',
        retry_count: typeof s.retry_count === 'number' ? Math.max(0, s.retry_count) : 0,
        probability: typeof s.probability === 'number' ? Math.max(0, Math.min(1, s.probability)) : 1,
        params: typeof s.params === 'object' && s.params !== null && !Array.isArray(s.params) ? s.params : {},
      })
    ).filter((r) => r.command_asset_id);

    if (stepRows.length > 0) {
      const { error: stepsErr } = await supabase.from('playbook_steps').insert(stepRows);
      if (stepsErr) {
        console.error('[playbooks] Steps insert failed', stepsErr);
        await supabase.from('playbooks').delete().eq('id', playbookId);
        return NextResponse.json({ error: stepsErr.message }, { status: 500 });
      }
    }

    const { data: full } = await supabase
      .from('playbooks')
      .select('id, name, description, created_at, updated_at')
      .eq('id', playbookId)
      .single();

    const { data: stepData } = await supabase
      .from('playbook_steps')
      .select('id, command_asset_id, sort_order, timeout_ms, on_failure, retry_count, probability, params')
      .eq('playbook_id', playbookId)
      .order('sort_order');

    return NextResponse.json(
      {
        id: full?.id ?? playbook.id,
        name: full?.name ?? playbook.name,
        description: full?.description ?? playbook.description,
        steps: stepData ?? [],
        created_at: full?.created_at ?? playbook.created_at,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[playbooks] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
