"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Square, RotateCcw } from "lucide-react"
import Link from "next/link"
import { DeviceHeatmap, type DeviceTileData, type DeviceTileStatus } from "@/components/dashboard/device-heatmap"
import { toast } from "sonner"

interface RunSummary {
  run_id: string
  trigger: string
  scope: string
  workflow_id: string | null
  status: string
  created_at: number | null
  started_at: number | null
  ended_at: number | null
  nodes: { node_id: string; status: string; summary: { succeeded: number; failed: number; timeout: number } }[]
  totals: { succeeded: number; failed: number; timeout: number }
}

interface StepDeviceResult {
  device_task_id: string
  device_id: string | null
  device_serial: string
  status: string
  started_at: string | null
  finished_at: string | null
  log_snippet: string | null
  artifact_id: string | null
  error_message: string | null
}

interface StepInfo {
  step_id: string
  sort_order: number
  device_results: StepDeviceResult[]
}

interface StepsResponse {
  run_id: string
  steps: StepInfo[]
}

type ApiDevice = {
  id: string
  device_id: string
  node_id: string | null
  last_seen_at: string | null
  last_error_message: string | null
  online: boolean
}

function statusToTileStatus(s: string): DeviceTileStatus {
  if (s === "running" || s === "pending") return "running"
  if (s === "failed" || s === "error" || s === "timeout") return "error"
  if (s === "completed" || s === "skipped") return "done"
  if (s === "wait" || s === "waiting") return "wait"
  return null
}

type DeviceRunInfo = {
  runStatus: DeviceTileStatus
  progress: string
  waitLabel?: string
  logs: string[]
  currentStep: string
  lastArtifactId: string | null
}

function buildByDeviceId(steps: StepInfo[]): Map<string, DeviceRunInfo> {
  const byDeviceId = new Map<string, DeviceRunInfo>()
  const totalSteps = steps.length
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx]
    for (const dr of step.device_results) {
      const key = dr.device_id ?? dr.device_task_id
      if (!key) continue
      if (!byDeviceId.has(key)) {
        byDeviceId.set(key, {
          runStatus: null,
          progress: "",
          logs: [],
          currentStep: step.step_id,
          lastArtifactId: null,
        })
      }
      const cur = byDeviceId.get(key)!
      cur.runStatus = statusToTileStatus(dr.status) ?? cur.runStatus
      cur.progress = `${stepIdx + 1}/${totalSteps}`
      if (dr.log_snippet) cur.logs.push(`[${step.step_id}] ${dr.log_snippet}`)
      if (dr.artifact_id) cur.lastArtifactId = dr.artifact_id
      cur.currentStep = step.step_id
    }
  }
  return byDeviceId
}

function buildTiles(
  devices: ApiDevice[],
  byDeviceId: Map<string, DeviceRunInfo>
): (DeviceTileData | null)[] {
  const tiles: (DeviceTileData | null)[] = devices.slice(0, 100).map((d, i) => {
    const info = d.device_id ? byDeviceId.get(d.device_id) : undefined
    return {
      id: d.id,
      device_id: d.device_id,
      index: i + 1,
      online: d.online,
      runStatus: info?.runStatus ?? null,
      progress: info?.progress,
      waitLabel: info?.waitLabel,
    }
  })
  while (tiles.length < 100) tiles.push(null)
  return tiles
}

export default function RunDetailPage() {
  const params = useParams()
  const runId = params.runId as string
  const [run, setRun] = useState<RunSummary | null>(null)
  const [stepsData, setStepsData] = useState<StepsResponse | null>(null)
  const [devices, setDevices] = useState<ApiDevice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTile, setSelectedTile] = useState<DeviceTileData | null>(null)
  const [stopLoading, setStopLoading] = useState(false)

  const fetchRun = useCallback(async () => {
    if (!runId) return null
    const res = await fetch(`/api/runs/${runId}`)
    if (!res.ok) throw new Error(res.status === 404 ? "실행을 찾을 수 없습니다." : "불러오기 실패")
    return res.json() as Promise<RunSummary>
  }, [runId])

  const fetchSteps = useCallback(async () => {
    if (!runId) return null
    const res = await fetch(`/api/runs/${runId}/steps`)
    if (!res.ok) return null
    return res.json() as Promise<StepsResponse>
  }, [runId])

  useEffect(() => {
    if (!runId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRun(),
      fetchSteps(),
      fetch("/api/devices").then((r) => r.json()).then((d: { devices?: ApiDevice[] }) => d.devices ?? []),
    ])
      .then(([runData, steps, deviceList]) => {
        if (cancelled) return
        if (runData) setRun(runData)
        else setError("실행을 찾을 수 없습니다.")
        setStepsData(steps ?? null)
        setDevices(deviceList)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "알 수 없는 오류")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runId, fetchRun, fetchSteps])

  const refreshSteps = useCallback(() => {
    if (!runId) return
    fetchSteps().then((data) => data && setStepsData(data))
  }, [runId, fetchSteps])

  const handleStop = async () => {
    setStopLoading(true)
    try {
      const res = await fetch(`/api/runs/${runId}/stop`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("실행 중단 요청을 보냈습니다.")
        fetchRun().then(setRun)
        refreshSteps()
      } else {
        toast.error(data.error ?? "중단 요청 실패")
      }
    } finally {
      setStopLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    )
  }
  if (error || !run) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-destructive">{error ?? "알 수 없는 오류"}</p>
        <Button variant="outline" asChild>
          <Link href="/runs">의식 실행 목록</Link>
        </Button>
      </div>
    )
  }

  const statusLabel: Record<string, string> = {
    queued: "대기열",
    running: "실행 중",
    completed: "완료",
    completed_with_errors: "완료(일부 오류)",
    failed: "실패",
  }

  const byDeviceId = buildByDeviceId(stepsData?.steps ?? [])
  const tiles = buildTiles(devices, byDeviceId)

  const selectedDevice = selectedTile
    ? devices.find((d) => d.id === selectedTile.id)
    : null
  const selectedInfo = selectedTile?.device_id ? byDeviceId.get(selectedTile.device_id) : null
  const lastLogs = (selectedInfo?.logs ?? []).slice(-50)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/runs">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">{run.run_id}</h1>
          <p className="text-sm text-muted-foreground">
            시작: {run.started_at ? new Date(run.started_at).toLocaleString("ko-KR") : "—"}
            {run.ended_at && ` · 종료: ${new Date(run.ended_at).toLocaleString("ko-KR")}`}
          </p>
        </div>
        {(run.status === "queued" || run.status === "running") && (
          <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopLoading}>
            <Square className="size-4 mr-2" />
            {stopLoading ? "요청 중…" : "Stop"}
          </Button>
        )}
      </div>

      <div className="flex gap-6 flex-wrap">
        <Card className="flex-1 min-w-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{statusLabel[run.status] ?? run.status}</Badge>
              <span className="text-xs text-muted-foreground">
                성공 {run.totals.succeeded} / 실패 {run.totals.failed} / 타임아웃 {run.totals.timeout}
              </span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={refreshSteps}>
                새로고침
              </Button>
            </div>
            <DeviceHeatmap
              devices={tiles}
              tileSize={36}
              showProgress
              selectedId={selectedTile?.id ?? null}
              onTileClick={setSelectedTile}
              className="mx-auto"
            />
          </CardContent>
        </Card>

        <Card className="w-80 shrink-0">
          <CardContent className="pt-6">
            {selectedTile && selectedDevice ? (
              <>
                <h3 className="font-semibold text-sm">Device #{selectedTile.index}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedDevice.online ? "default" : "destructive"} className="text-xs">
                    {selectedDevice.online ? "Online" : "Offline"}
                  </Badge>
                </div>
                {selectedDevice.last_seen_at && (
                  <p className="text-xs text-muted-foreground mt-1">last_seen: {new Date(selectedDevice.last_seen_at).toLocaleString("ko-KR")}</p>
                )}
                {selectedDevice.last_error_message && (
                  <p className="text-xs text-destructive mt-1 truncate" title={selectedDevice.last_error_message}>
                    {selectedDevice.last_error_message}
                  </p>
                )}
                {selectedInfo && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">현재 스텝: {selectedInfo.currentStep}</p>
                    <p className="text-xs text-muted-foreground">진행: {selectedInfo.progress}</p>
                  </>
                )}
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">최근 로그 (최대 50줄)</p>
                  <div className="rounded bg-muted/50 p-2 max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5">
                    {lastLogs.length > 0 ? (
                      lastLogs.map((line) => <div key={line}>{line}</div>)
                    ) : (
                      <span className="text-muted-foreground">로그 없음</span>
                    )}
                  </div>
                </div>
                {selectedInfo?.lastArtifactId && (
                  <p className="text-xs text-muted-foreground mt-2">마지막 스크린샷: {selectedInfo.lastArtifactId}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="text-xs" asChild>
                    <Link href="/dashboard/artifacts">기록 보기</Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" disabled>
                    <RotateCcw className="size-3 mr-1" />
                    Retry (준비 중)
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">타일을 클릭하면 디바이스 실행 과정을 볼 수 있습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" asChild>
        <Link href="/runs">의식 실행 목록으로</Link>
      </Button>
    </div>
  )
}
