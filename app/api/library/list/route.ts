/**
 * GET /api/library/list — list command_assets with optional type, folder, q
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') || undefined;
    const folder = searchParams.get('folder') || undefined;
    const q = searchParams.get('q') || undefined;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('command_assets')
      .select('id, title, folder, asset_type, kind, storage_path, inline_content, default_timeout_ms, description, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (type) {
      query = query.eq('asset_type', type);
    }
    if (folder) {
      query = query.eq('folder', folder);
    }
    if (q && q.trim()) {
      query = query.or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
    }

    const { data: items, error } = await query;

    if (error) {
      console.error('[library/list] Query failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: items ?? [] });
  } catch (err) {
    console.error('[library/list] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
