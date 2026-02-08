/**
 * GET /api/library/catalogs — list L1 action catalogs (read-only)
 * Reads command_catalogs/*.json from repo.
 */

import { NextResponse } from 'next/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATALOGS_DIR = 'command_catalogs';

export async function GET() {
  try {
    const base = process.cwd();
    const dir = join(base, CATALOGS_DIR);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return NextResponse.json({ catalogs: [] });
    }
    const catalogs: { catalog_id: string; domain?: string; version?: number }[] = [];
    for (const f of files) {
      try {
        const raw = readFileSync(join(dir, f), 'utf-8');
        const data = JSON.parse(raw) as { catalog_id?: string; domain?: string; version?: number };
        catalogs.push({
          catalog_id: data.catalog_id ?? f.replace(/\.json$/, ''),
          domain: data.domain,
          version: data.version,
        });
      } catch {
        // skip invalid json
      }
    }
    return NextResponse.json({ catalogs });
  } catch (err) {
    console.error('[library/catalogs] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
