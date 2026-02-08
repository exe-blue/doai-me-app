/**
 * POST /api/library/upload — multipart form-data → Storage command-assets + command_assets row
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ASSET_TYPE_TO_KIND: Record<string, 'adb' | 'js' | 'vendor' | 'assert'> = {
  adb_script: 'adb',
  js: 'js',
  json: 'js',
  text: 'adb',
  vendor_action: 'vendor',
};

const VALID_ASSET_TYPES = new Set(['adb_script', 'js', 'json', 'text', 'vendor_action']);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const folder = (formData.get('folder') as string) || null;
    const assetTypeRaw = (formData.get('asset_type') as string) || 'adb_script';
    const asset_type = VALID_ASSET_TYPES.has(assetTypeRaw) ? assetTypeRaw : 'adb_script';
    const description = (formData.get('description') as string) || null;
    const defaultTimeoutMs = formData.get('default_timeout_ms');
    const default_timeout_ms =
      typeof defaultTimeoutMs === 'string' && defaultTimeoutMs !== ''
        ? Number.parseInt(defaultTimeoutMs, 10)
        : null;

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext = file.name.split('.').pop() || 'txt';
    const storagePath = `${Date.now()}-${title.trim().slice(0, 50).replaceAll(/\s+/g, '-')}.${ext}`;

    const buf = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
      .from('command-assets')
      .upload(storagePath, buf, { contentType: file.type || 'application/octet-stream', upsert: false });

    if (uploadErr) {
      console.error('[library/upload] Storage upload failed', uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const kind = ASSET_TYPE_TO_KIND[asset_type] ?? 'adb';

    const { data: row, error: insertErr } = await supabase
      .from('command_assets')
      .insert({
        kind,
        title: title.trim(),
        description: description?.trim() || null,
        storage_path: storagePath,
        inline_content: null,
        default_timeout_ms: default_timeout_ms ?? undefined,
        folder: folder?.trim() || null,
        asset_type,
        updated_at: new Date().toISOString(),
      })
      .select('id, title, folder, asset_type, storage_path, default_timeout_ms, created_at')
      .single();

    if (insertErr || !row) {
      console.error('[library/upload] Insert failed', insertErr);
      return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: row.id,
        title: row.title,
        folder: row.folder,
        asset_type: row.asset_type,
        storage_path: row.storage_path,
        default_timeout_ms: row.default_timeout_ms,
        created_at: row.created_at,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[library/upload] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
