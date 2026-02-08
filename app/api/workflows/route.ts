/**
 * DoAi.Me MVP — List workflows (for run create dropdown)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const supabase = createClient(url, key);

  const { data: rows, error } = await supabase
    .from('workflows')
    .select('workflow_id, version, name')
    .order('workflow_id');

  if (error) {
    console.error('[workflows] List failed', error);
    return NextResponse.json({ error: 'List failed' }, { status: 500 });
  }

  const workflows = (rows ?? []).map((r) => ({
    workflow_id: r.workflow_id,
    version: Number.parseInt(String(r.version), 10) || 1,
    name: r.name,
  }));

  return NextResponse.json({ workflows });
}
