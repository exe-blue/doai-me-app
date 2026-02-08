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
    const body = await req.json().catch(() => ({}));
    const title = body.title ?? body.name;
    const steps = Array.isArray(body.steps) ? body.steps : [];

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'title required' } }, { status: 400 });
    }
    if (steps.length === 0) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'steps is empty' } }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: playbook, error: pbErr } = await supabase
      .from('playbooks')
      .insert({
        name: title.trim(),
        description: body.description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (pbErr || !playbook) {
      console.error('[playbooks] Insert failed', pbErr);
      return NextResponse.json({ error: pbErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    const playbookId = playbook.id;
    const stepRows = steps
      .map((s: Record<string, unknown>, i: number) => {
        const ref = s.ref ?? s.command_asset_id;
        if (!ref) return null;
        return {
          playbook_id: playbookId,
          command_asset_id: ref,
          sort_order: typeof s.sort_order === 'number' ? s.sort_order : i,
          timeout_ms: typeof s.timeoutMs === 'number' ? s.timeoutMs : typeof s.timeout_ms === 'number' ? s.timeout_ms : null,
          on_failure: ['stop', 'continue', 'retry'].includes((s.onFailure ?? s.on_failure) as string) ? (s.onFailure ?? s.on_failure) : 'stop',
          retry_count: typeof s.retryCount === 'number' ? s.retryCount : typeof s.retry_count === 'number' ? s.retry_count : 0,
          probability: typeof s.probability === 'number' ? Math.max(0, Math.min(1, s.probability)) : 1,
          params: typeof s.params === 'object' && s.params !== null && !Array.isArray(s.params) ? s.params : {},
        };
      })
      .filter(Boolean) as { playbook_id: string; command_asset_id: string; sort_order: number; timeout_ms: number | null; on_failure: string; retry_count: number; probability: number; params: Record<string, unknown> }[];

    if (stepRows.length > 0) {
      const { error: stepsErr } = await supabase.from('playbook_steps').insert(stepRows);
      if (stepsErr) {
        await supabase.from('playbooks').delete().eq('id', playbookId);
        return NextResponse.json({ error: stepsErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: playbookId }, { status: 201 });
  } catch (err) {
    console.error('[playbooks] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
