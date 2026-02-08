"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  AlertTriangle,
  ExternalLink,
  Radio,
} from "lucide-react"
import Link from "next/link"

type DashboardRes = {
  window: { type: string; hours: number; start: string; end: string }
  kpis: {
    runs_succeeded: number
    runs_failed: number
    devices_running: number
    devices_online: number
    devices_offline: number
    needs_attention: number
  }
  series: {
    runs_per_hour: { t: string; started: number; succeeded: number; failed: number }[]
    device_offline_per_hour: { t: string; offline: number }[]
    content_new_per_hour: { t: string; new: number }[]
  }
  topology: {
    nodes_total: number
    nodes_online: number
    devices_total: number
    by_node: { node_id: string; online: number; offline: number }[]
  }
  todo: { kind: string; count?: number; label: string; href: string }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardRes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/dashboard?window=24")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const k = data?.kpis
  const series = data?.series
  const topo = data?.topology
  const todoList = data?.todo ?? []

  const runsPerHour = series?.runs_per_hour ?? []
  const maxStarted = Math.max(1, ...runsPerHour.map((x) => x.started))
  const offlinePerHour = series?.device_offline_per_hour ?? []
  const maxOffline = Math.max(1, ...offlinePerHour.map((x) => x.offline))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          24시간 운영 요약 · 지금 당장 해야 할 일
        </p>
      </div>

      {/* A. KPI 카드 6개 — /api/dashboard kpis */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link href="/runs?status=done&window=24h" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">실행 완료 (24h)</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : (k?.runs_succeeded ?? 0)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/runs?status=error&window=24h" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-500" />
                <span className="text-xs text-muted-foreground">실패 (24h)</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : (k?.runs_failed ?? 0)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/runs?status=running" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <Radio className="size-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">실행 중 디바이스</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : (k?.devices_running ?? 0)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/devices?filter=online" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <Wifi className="size-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Online / 전체</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">
                {loading ? "—" : `${k?.devices_online ?? 0} / ${(k?.devices_online ?? 0) + (k?.devices_offline ?? 0)}`}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/devices?filter=offline" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <WifiOff className="size-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Offline</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : (k?.devices_offline ?? 0)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/devices?filter=needs-attention" className="block">
          <Card className="py-3 hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">즉시 조치 필요</span>
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : (k?.needs_attention ?? 0)}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* B. 시간대별 그래프 — series from /api/dashboard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">시간대별 실행량 (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-0.5">
              {(runsPerHour.length ? runsPerHour : Array.from({ length: 24 }, (_, i) => ({ t: `${i}:00`, started: 0, succeeded: 0, failed: 0 }))).map((b, i) => (
                <div
                  key={b.t ?? i}
                  className="flex-1 rounded-t bg-primary/30 min-h-1"
                  style={{ height: `${(b.started / maxStarted) * 100}%` }}
                  title={`${b.t} started: ${b.started} succeeded: ${b.succeeded} failed: ${b.failed}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">0~23시 (started)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline 기기 수 (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-0.5">
              {(offlinePerHour.length ? offlinePerHour : [{ t: data?.window?.start ?? "", offline: 0 }]).map((b, i) => (
                <div
                  key={b.t ?? i}
                  className="flex-1 rounded-t bg-red-500/30 min-h-1"
                  style={{ height: `${(b.offline / maxOffline) * 100}%` }}
                  title={`${b.t} offline: ${b.offline}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">MVP: 현재값</p>
          </CardContent>
        </Card>
      </div>

      {/* C. 토폴로지 — topology from /api/dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">토폴로지 요약</CardTitle>
          <p className="text-xs text-muted-foreground">노드 수 · node별 Online/Offline</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            노드 <span className="font-mono font-bold">{loading ? "—" : `${topo?.nodes_online ?? 0} / ${topo?.nodes_total ?? 0}`}</span> (online / 전체)
            · 기기 <span className="font-mono font-bold">{topo?.devices_total ?? 0}</span>
          </p>
          {topo?.by_node && topo.by_node.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">노드</TableHead>
                    <TableHead className="text-xs">Online</TableHead>
                    <TableHead className="text-xs">Offline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topo.by_node.slice(0, 5).map((row) => (
                    <TableRow key={row.node_id}>
                      <TableCell className="font-mono text-xs">{row.node_id}</TableCell>
                      <TableCell className="text-xs text-emerald-600">{row.online}</TableCell>
                      <TableCell className="text-xs text-red-600">{row.offline}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {topo.by_node.length > 5 && (
                <Button variant="link" className="mt-2 h-auto p-0 text-xs" asChild>
                  <Link href="/devices">더보기</Link>
                </Button>
              )}
            </div>
          )}
          {!loading && (!topo?.by_node?.length) && (
            <p className="text-xs text-muted-foreground">기기 데이터 없음</p>
          )}
        </CardContent>
      </Card>

      {/* D. 즉시 조치 To-do — todo[] from /api/dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">즉시 조치</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {todoList.map((item, i) => (
              <li key={`${item.kind}-${i}`} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <span className="text-sm">{item.count != null ? `${item.label} ${item.count}` : item.label}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={item.href}>
                    <ExternalLink className="size-3 mr-1" />
                    열기
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/runs" className="underline hover:no-underline">실행 목록</Link>
        {" · "}
        <Link href="/devices" className="underline hover:no-underline">기기 화면</Link>
        {" · "}
        <Link href="/content" className="underline hover:no-underline">콘텐츠</Link>
      </p>
    </div>
  )
}
