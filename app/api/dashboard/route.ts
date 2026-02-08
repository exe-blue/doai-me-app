/**
 * GET /api/dashboard?window=24h
 * MVP: KPIs (rolling 24h), series (runs per hour, offline per hour, content new per hour), topology, todo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { HEATMAP_COLS, HEATMAP_MINI_TILE_SIZE } from '@/lib/heatmap';

const ONLINE_WINDOW_SEC = 30;
const DEFAULT_WINDOW_HOURS = 24;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const windowHours = Math.min(168, Math.max(1, parseInt(searchParams.get('window') ?? '24', 10) || DEFAULT_WINDOW_HOURS));
    const end = new Date();
    const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // KPI 1–2: runs succeeded / failed in window (by finished_at)
    const { data: runs } = await supabase
      .from('runs')
      .select('id, status, finished_at, started_at')
      .gte('finished_at', startISO)
      .lte('finished_at', endISO);

    const runsSucceeded = (runs ?? []).filter((r) => r.status === 'completed' || r.status === 'completed_with_errors').length;
    const runsFailed = (runs ?? []).filter((r) => r.status === 'failed').length;

    // KPI 3: devices currently running (from device_tasks)
    const { data: runningTasks } = await supabase
      .from('device_tasks')
      .select('device_id')
      .eq('status', 'running');
    const runningDeviceIds = new Set((runningTasks ?? []).map((t) => t.device_id).filter(Boolean));
    const devicesRunning = runningDeviceIds.size;

    // KPI 4–6: devices online/offline/needs_attention
    const { data: devices } = await supabase
      .from('devices')
      .select('id, device_id, node_id, last_seen_at, last_error_message');
    const devicesList = devices ?? [];
    const nowMs = Date.now();
    const onlineCutoff = nowMs - ONLINE_WINDOW_SEC * 1000;
    let devicesOnline = 0;
    let devicesOffline = 0;
    let needsAttention = 0;
    for (const d of devicesList) {
      const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
      const online = lastSeen >= onlineCutoff;
      if (online) devicesOnline++; else devicesOffline++;
      if (!online && (d.last_error_message ?? '').trim()) needsAttention++;
    }
    const devicesTotal = devicesList.length;

    // Series: runs per hour (by started_at)
    const { data: runsForSeries } = await supabase
      .from('runs')
      .select('started_at, finished_at, status')
      .gte('started_at', startISO)
      .lte('started_at', endISO);
    const hourBuckets = new Map<string, { started: number; succeeded: number; failed: number }>();
    for (let i = 0; i < windowHours; i++) {
      const t = new Date(start.getTime() + i * 60 * 60 * 1000);
      const key = t.toISOString().slice(0, 13) + ':00:00.000Z';
      hourBuckets.set(key, { started: 0, succeeded: 0, failed: 0 });
    }
    for (const r of runsForSeries ?? []) {
      const startedAt = r.started_at ?? r.finished_at;
      if (!startedAt) continue;
      const t = new Date(startedAt);
      const key = t.toISOString().slice(0, 13) + ':00:00.000Z';
      if (!hourBuckets.has(key)) hourBuckets.set(key, { started: 0, succeeded: 0, failed: 0 });
      const b = hourBuckets.get(key)!;
      b.started++;
      if (r.status === 'completed' || r.status === 'completed_with_errors') b.succeeded++;
      else if (r.status === 'failed') b.failed++;
    }
    const runsPerHour = Array.from(hourBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, v]) => ({ t, ...v }));

    // device_offline_per_hour: MVP no history table — return current snapshot in one bucket
    const deviceOfflinePerHour = [{ t: startISO, offline: devicesOffline }];

    // content_new_per_hour: from contents where published_at in window
    const { data: contentsInWindow } = await supabase
      .from('contents')
      .select('published_at')
      .gte('published_at', startISO)
      .lte('published_at', endISO);
    const contentHourBuckets = new Map<string, number>();
    for (let i = 0; i < windowHours; i++) {
      const t = new Date(start.getTime() + i * 60 * 60 * 1000);
      const key = t.toISOString().slice(0, 13) + ':00:00.000Z';
      contentHourBuckets.set(key, 0);
    }
    for (const c of contentsInWindow ?? []) {
      const pub = c.published_at;
      if (!pub) continue;
      const key = new Date(pub).toISOString().slice(0, 13) + ':00:00.000Z';
      contentHourBuckets.set(key, (contentHourBuckets.get(key) ?? 0) + 1);
    }
    const contentNewPerHour = Array.from(contentHourBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, count]) => ({ t, new: count }));

    // Topology: nodes + devices by node
    const { data: nodes } = await supabase.from('node_heartbeats').select('node_id, updated_at').order('node_id');
    const nodeIds = [...new Set((nodes ?? []).map((n) => n.node_id))];
    const byNode: { node_id: string; online: number; offline: number }[] = [];
    for (const nid of nodeIds) {
      let on = 0, off = 0;
      for (const d of devicesList) {
        const dev = d as { node_id?: string; last_seen_at?: string };
        if (dev.node_id !== nid) continue;
        const lastSeen = dev.last_seen_at ? new Date(dev.last_seen_at).getTime() : 0;
        if (lastSeen >= onlineCutoff) on++; else off++;
      }
      byNode.push({ node_id: nid, online: on, offline: off });
    }
    const nodesOnline = nodeIds.length; // MVP: no heartbeat expiry, all listed = online
    const nodesTotal = nodeIds.length;

    // Todo
    const todo: { kind: string; count?: number; label: string; href: string }[] = [];
    if (devicesOffline > 0) todo.push({ kind: 'devices_offline', count: devicesOffline, label: 'Offline 기기', href: '/devices?filter=offline' });
    if (runsFailed > 0) todo.push({ kind: 'runs_failed_recent', count: runsFailed, label: '최근 1시간 실패', href: '/runs?status=error&window=24h' });
    if (needsAttention > 0) todo.push({ kind: 'needs_attention', count: needsAttention, label: '즉시 조치 필요', href: '/devices?filter=needs-attention' });
    todo.push({ kind: 'scan_stale', label: '스캔', href: '/devices' });
    const newContent24h = (contentsInWindow ?? []).length;
    todo.push({ kind: 'content_new', count: newContent24h, label: '24h 신규 콘텐츠', href: '/content' });

    // mini_heatmap: 노드 단위. 노드당 100슬롯(10×10). items는 sparse, UI에서 100칸으로 정규화.
    const { data: devicesForHeatmap } = await supabase
      .from('devices')
      .select('index_no, node_id, last_seen_at')
      .not('index_no', 'is', null);
    const onlineCutoffISO = new Date(Date.now() - ONLINE_WINDOW_SEC * 1000).toISOString();
    const mini_heatmap_nodes = byNode.map((node, i) => {
      const node_id = node.node_id;
      const items: { index: number; online: boolean }[] = (devicesForHeatmap ?? [])
        .filter((d) => (d as { node_id: string | null }).node_id === node_id)
        .map((d) => {
          const index = (d as { index_no: number }).index_no;
          const lastSeen = (d as { last_seen_at: string | null }).last_seen_at;
          const online = lastSeen != null && lastSeen >= onlineCutoffISO;
          return { index, online };
        });
      return {
        node_id,
        label: `노드 ${i + 1}`,
        items,
        counts: { online: node.online, offline: node.offline },
      };
    });

    const body = {
      window: { hours: windowHours, start: startISO, end: endISO },
      kpis: {
        runs_succeeded: runsSucceeded,
        runs_failed: runsFailed,
        devices_running: devicesRunning,
        devices_online: devicesOnline,
        devices_offline: devicesOffline,
        needs_attention: needsAttention,
      },
      series: {
        runs_per_hour: runsPerHour,
        offline_per_hour: deviceOfflinePerHour,
        content_new_per_hour: contentNewPerHour,
      },
      topology: {
        nodes_total: nodesTotal,
        nodes_online: nodesOnline,
        devices_total: devicesTotal,
        by_node: byNode,
      },
      todo,
      mini_heatmap: {
        slot: { cols: 10, rows: 10, perNode: 100 },
        nodes: mini_heatmap_nodes,
      },
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('[dashboard] Error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
