/**
 * GET /api/library/catalogs/[catalogId] — single L1 catalog JSON (read-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOGS_DIR = 'command_catalogs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> }
) {
  try {
    const { catalogId } = await params;
    if (!catalogId || /[^a-z0-9_-]/i.test(catalogId)) {
      return NextResponse.json({ error: 'Invalid catalog id' }, { status: 400 });
    }
    const base = process.cwd();
    const path = join(base, CATALOGS_DIR, `${catalogId}.json`);
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });
    }
    console.error('[library/catalogs/[catalogId]] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
