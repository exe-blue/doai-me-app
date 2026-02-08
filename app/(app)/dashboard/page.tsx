"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { DeviceHeatmap, type DeviceTileData } from "@/components/dashboard/device-heatmap"

type RunRow = { id: string; trigger: string; target: string; status: string; started: string }
type ApiDevice = { id: string; device_id: string; online: boolean; last_error_message?: string | null }

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [devices, setDevices] = useState<ApiDevice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/runs").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/devices").then((r) => (r.ok ? r.json() : { devices: [] })),
    ]).then(([rRes, dRes]) => {
      if (cancelled) return
      setRuns(Array.isArray(rRes) ? rRes : [])
      setDevices(Array.isArray((dRes as { devices?: ApiDevice[] })?.devices) ? (dRes as { devices: ApiDevice[] }).devices : [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const completed24h = runs.filter((r) => r.status === "completed").length
  const failed24h = runs.filter((r) => r.status === "failed").length
  const runningCount = runs.filter((r) => r.status === "running").length
  const onlineCount = devices.filter((d) => d.online).length
  const offlineCount = devices.filter((d) => !d.online).length
  const totalDevices = devices.length
  const errorRepeatCount = devices.filter((d) => d.last_error_message).length

  const heatmapTiles: (DeviceTileData | null)[] = devices.slice(0, 100).map((d, i) => ({
    id: d.id,
    device_id: d.device_id,
    index: i + 1,
    online: d.online,
  }))
  while (heatmapTiles.length < 100) heatmapTiles.push(null)

  const triageItems = [
    offlineCount > 0 && {
      label: `Offline 기기 ${offlineCount}대 (스캔/재연결 필요)`,
      href: "/devices?filter=offline",
      button: "기기 보기",
    },
    failed24h > 0 && {
      label: `최근 실패 run ${failed24h}건`,
      href: "/runs",
      button: "실행 보기",
    },
    errorRepeatCount > 0 && {
      label: `에러 반복 디바이스 ${errorRepeatCount}대`,
      href: "/devices",
      button: "기기 보기",
    },
  ].filter(Boolean) as { label: string; href: string; button: string }[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">
          24시간 운영 요약 · 지금 당장 해야 할 일
        </p>
      </div>

      {/* A. KPI 카드 6개 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">실행 완료 (24h)</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : completed24h}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-red-500" />
              <span className="text-xs text-muted-foreground">실패 (24h)</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : failed24h}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">실행 중 디바이스</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : runningCount}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <Wifi className="size-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Online / 전체</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">
              {loading ? "—" : `${onlineCount} / ${totalDevices}`}
            </p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <WifiOff className="size-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{loading ? "—" : offlineCount}</p>
            {offlineCount > 0 && (
              <Button variant="link" className="h-auto p-0 text-xs mt-1" asChild>
                <Link href="/devices?filter=offline">기기 보기</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">즉시 조치 필요</span>
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">
              {loading ? "—" : (offlineCount + errorRepeatCount + (failed24h > 0 ? 1 : 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* B. 24h 타임라인 (플레이스홀더) + 미니 히트맵 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">시간대별 실행량 (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end gap-0.5">
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/20 min-h-2"
                  style={{ height: `${15 + (i % 5) * 12}%` }}
                  title={`${i}시`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">0~23시 (실제 데이터 연동 예정)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기기 미니맵</CardTitle>
            <p className="text-xs text-muted-foreground">클릭 시 기기 화면으로</p>
          </CardHeader>
          <CardContent>
            <Link href="/devices" className="block w-fit">
              <DeviceHeatmap
                devices={heatmapTiles}
                tileSize={24}
                className="mx-auto"
              />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 시간대별 Offline (플레이스홀더) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시간대별 Offline 기기 수 (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-end gap-0.5">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-red-500/20 min-h-1"
                style={{ height: `${10 + (i % 4) * 10}%` }}
                title={`${i}시`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* C. 지금 해야 할 일 트리아지 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">지금 해야 할 일</CardTitle>
        </CardHeader>
        <CardContent>
          {triageItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">당장 조치할 항목이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {triageItems.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <span className="text-sm">{item.label}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={item.href}>
                      <ExternalLink className="size-3 mr-1" />
                      {item.button}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 최근 실행 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 의식 실행</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">실행 ID</TableHead>
                <TableHead className="text-xs">트리거</TableHead>
                <TableHead className="text-xs">대상</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">시작</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.slice(0, 10).map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs">{run.id}</TableCell>
                  <TableCell className="text-xs">{run.trigger}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">{run.target}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        run.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : run.status === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : run.status === "running"
                              ? "bg-blue-500/10 text-blue-500"
                              : ""
                      }
                    >
                      {run.status === "completed" ? "완료" : run.status === "failed" ? "실패" : run.status === "running" ? "실행 중" : run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{run.started}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-6" asChild>
                      <Link href={`/runs/${run.id}`}>
                        <ExternalLink className="size-3" />
                        <span className="sr-only">상세</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
