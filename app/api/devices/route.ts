/**
 * GET /api/devices — Status Dashboard: list devices, Online = last_seen_at within threshold
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ONLINE_THRESHOLD_SEC = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const node_id = searchParams.get('node_id') || undefined;
    const online_only = searchParams.get('online_only') === 'true';

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('devices')
      .select('id, device_id, node_id, last_seen_at, last_error_message, created_at, updated_at')
      .order('last_seen_at', { ascending: false, nullsFirst: false });

    if (node_id) {
      query = query.eq('node_id', node_id);
    }
    if (online_only) {
      const threshold = new Date(Date.now() - ONLINE_THRESHOLD_SEC * 1000).toISOString();
      query = query.gte('last_seen_at', threshold);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('[devices] Query failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_SEC * 1000).getTime();
    const devices = (rows ?? []).map((d) => {
      const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : null;
      const online = lastSeen !== null && lastSeen >= threshold;
      return {
        id: d.id,
        device_id: d.device_id,
        node_id: d.node_id,
        last_seen_at: d.last_seen_at,
        last_error_message: d.last_error_message,
        online,
      };
    });

    return NextResponse.json({ devices });
  } catch (err) {
    console.error('[devices] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
