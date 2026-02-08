"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RotateCcw, Square, ExternalLink, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const GLOBAL_TIMEOUT_MIN = 60000
const GLOBAL_TIMEOUT_MAX = 1800000

const STEP_KEYS = ["PREFLIGHT", "BOOTSTRAP", "LOGIN_FLOW", "SCREENSHOT", "UPLOAD"] as const
const STEP_TIMEOUT_MIN = 5000
const STEP_TIMEOUT_MAX = 600000

type RunStatus = "대기열" | "실행 중" | "완료" | "실패" | "중단됨"
type RunStep = "관측" | "등록" | "배포" | "행동" | "기록"

const STEPS: RunStep[] = ["관측", "등록", "배포", "행동", "기록"]

interface Run {
  id: string
  trigger: string
  target: string
  step: RunStep
  status: RunStatus
  startedAt: string
  endedAt: string
  artifactCount: number
  logs: string[]
}

const runs: Run[] = [
  { id: "RUN-0047", trigger: "유튜브", target: "ALL", step: "기록", status: "완료", startedAt: "14:32", endedAt: "14:58", artifactCount: 142, logs: ["[14:32] 실행 시작", "[14:35] 관측 완료 — 142 기기", "[14:42] 등록 완료", "[14:48] 배포 진행", "[14:52] 행동 수집 완료", "[14:58] 기록 업로드 완료"] },
  { id: "RUN-0046", trigger: "수동", target: "20대", step: "행동", status: "실행 중", startedAt: "14:18", endedAt: "—", artifactCount: 0, logs: ["[14:18] 실행 시작", "[14:20] 관측 완료 — 20 기기", "[14:23] 등록 완료", "[14:28] 배포 진행 중", "[14:31] 행동 수집 중…"] },
  { id: "RUN-0045", trigger: "유튜브", target: "ALL", step: "기록", status: "완료", startedAt: "13:55", endedAt: "14:12", artifactCount: 138, logs: ["[13:55] 실행 시작", "[14:12] 기록 업로드 완료"] },
  { id: "RUN-0044", trigger: "유튜브", target: "20대", step: "배포", status: "실패", startedAt: "13:22", endedAt: "13:35", artifactCount: 0, logs: ["[13:22] 실행 시작", "[13:28] 등록 완료", "[13:35] 배포 실패 — timeout"] },
  { id: "RUN-0043", trigger: "수동", target: "ALL", step: "기록", status: "완료", startedAt: "12:50", endedAt: "13:08", artifactCount: 140, logs: ["[12:50] 실행 시작", "[13:08] 기록 완료"] },
  { id: "RUN-0042", trigger: "유튜브", target: "20대", step: "기록", status: "완료", startedAt: "12:31", endedAt: "12:42", artifactCount: 18, logs: ["[12:31] 실행 시작", "[12:42] 완료"] },
  { id: "RUN-0041", trigger: "유튜브", target: "ALL", step: "기록", status: "완료", startedAt: "11:45", endedAt: "12:05", artifactCount: 139, logs: ["[11:45] 시작", "[12:05] 완료"] },
  { id: "RUN-0040", trigger: "수동", target: "20대", step: "관측", status: "대기열", startedAt: "—", endedAt: "—", artifactCount: 0, logs: ["대기열 진입…"] },
]

function runStatusBadge(status: RunStatus) {
  const map: Record<RunStatus, string> = {
    "대기열": "bg-secondary text-secondary-foreground border-border",
    "실행 중": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "완료": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "실패": "bg-red-500/10 text-red-500 border-red-500/20",
    "중단됨": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  }
  return <Badge variant="secondary" className={map[status]}>{status}</Badge>
}

function StepperProgress({ currentStep, status }: { currentStep: RunStep; status: RunStatus }) {
  const currentIdx = STEPS.indexOf(currentStep)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = status === "완료" || i < currentIdx
        const active = i === currentIdx && status !== "완료" && status !== "실패"
        const failed = i === currentIdx && status === "실패"
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-medium border transition-colors",
                  done && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
                  active && "bg-blue-500/20 text-blue-500 border-blue-500/30 animate-pulse",
                  failed && "bg-red-500/20 text-red-500 border-red-500/30",
                  !done && !active && !failed && "bg-secondary text-muted-foreground border-border"
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </div>
              <span className={cn(
                "text-[8px] leading-none",
                done ? "text-emerald-500" : active ? "text-blue-500" : failed ? "text-red-500" : "text-muted-foreground"
              )}>{step}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-px w-3 mb-3",
                done ? "bg-emerald-500/40" : "bg-border"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const tabMap: Record<string, RunStatus> = {
  "queue": "대기열",
  "running": "실행 중",
  "done": "완료",
  "failed": "실패",
  "stopped": "중단됨",
}

export default function RunsPage() {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [tab, setTab] = useState("all")

  const filtered = tab === "all" ? runs : runs.filter((r) => r.status === tabMap[tab])

  const [createOpen, setCreateOpen] = useState(false)
  const [youtubeVideoId, setYoutubeVideoId] = useState("")
  const [globalTimeoutMs, setGlobalTimeoutMs] = useState<string>("600000")
  const [workflows, setWorkflows] = useState<{ workflow_id: string; name: string }[]>([])
  const [workflowId, setWorkflowId] = useState("login_settings_screenshot_v1")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [timeoutOverrides, setTimeoutOverrides] = useState<Record<string, string>>({
    PREFLIGHT: "",
    BOOTSTRAP: "",
    LOGIN_FLOW: "",
    SCREENSHOT: "",
    UPLOAD: "",
  })

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((d: { workflows?: { workflow_id: string; name: string }[] }) =>
        setWorkflows(d.workflows ?? [])
      )
      .catch(() => {})
  }, [])

  const handleCreateRun = async () => {
    const timeout = parseInt(globalTimeoutMs, 10)
    if (isNaN(timeout) || timeout < GLOBAL_TIMEOUT_MIN || timeout > GLOBAL_TIMEOUT_MAX) {
      return
    }
    const overrides: Record<string, number> = {}
    if (showAdvanced) {
      for (const [key, val] of Object.entries(timeoutOverrides)) {
        const n = parseInt(val, 10)
        if (!Number.isNaN(n) && n > 0) overrides[key] = n
      }
    }
    const body: Record<string, unknown> = {
      trigger: "manual",
      scope: "ALL",
      youtubeVideoId: youtubeVideoId.trim() || null,
      workflow_id: workflowId,
      globalTimeoutMs: timeout,
    }
    if (Object.keys(overrides).length > 0) body.timeoutOverrides = overrides
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCreateOpen(false)
      setYoutubeVideoId("")
      setGlobalTimeoutMs("600000")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">의식 실행</h1>
          <p className="text-sm text-muted-foreground mt-1">등록된 사건이 행동으로 변환됩니다.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Run 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Run 생성</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="workflowId">Workflow</Label>
                <select
                  id="workflowId"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {workflows.length ? workflows.map((w) => (
                    <option key={w.workflow_id} value={w.workflow_id}>{w.name}</option>
                  )) : (
                    <>
                      <option value="bootstrap_only_v1">Bootstrap Only</option>
                      <option value="login_settings_screenshot_v1">Login → Settings → Screenshot</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <Label htmlFor="youtubeVideoId">YouTube Video ID (선택, 수동이면 비움)</Label>
                <Input
                  id="youtubeVideoId"
                  placeholder="dQw4w9WgXcQ"
                  value={youtubeVideoId}
                  onChange={(e) => setYoutubeVideoId(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="globalTimeoutMs">전체 타임아웃 (ms, {GLOBAL_TIMEOUT_MIN / 1000}s ~ {GLOBAL_TIMEOUT_MAX / 60000}분)</Label>
                <Input
                  id="globalTimeoutMs"
                  type="number"
                  min={GLOBAL_TIMEOUT_MIN}
                  max={GLOBAL_TIMEOUT_MAX}
                  value={globalTimeoutMs}
                  onChange={(e) => setGlobalTimeoutMs(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "고급 옵션 접기" : "고급 옵션 (step 타임아웃)"}
                </Button>
                {showAdvanced && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["PREFLIGHT", "BOOTSTRAP", "LOGIN_FLOW", "SCREENSHOT", "UPLOAD"] as const).map((key) => (
                      <div key={key}>
                        <Label className="text-xs">{key} (ms)</Label>
                        <Input
                          type="number"
                          placeholder="미지정"
                          value={timeoutOverrides[key] ?? ""}
                          onChange={(e) => setTimeoutOverrides((p) => ({ ...p, [key]: e.target.value }))}
                          className="mt-1 h-8"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleCreateRun}>
                생성
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all" className="text-xs">전체</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs">대기열</TabsTrigger>
          <TabsTrigger value="running" className="text-xs">실행 중</TabsTrigger>
          <TabsTrigger value="done" className="text-xs">완료</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">실패</TabsTrigger>
          <TabsTrigger value="stopped" className="text-xs">중단됨</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card className="py-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">실행 ID</TableHead>
                    <TableHead className="text-xs">트리거</TableHead>
                    <TableHead className="text-xs">대상</TableHead>
                    <TableHead className="text-xs">단계</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                    <TableHead className="text-xs">시작/종료</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((run) => (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRun(run)}
                    >
                      <TableCell className="font-mono text-xs">{run.id}</TableCell>
                      <TableCell className="text-xs">{run.trigger}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{run.target}</Badge>
                      </TableCell>
                      <TableCell>
                        <StepperProgress currentStep={run.step} status={run.status} />
                      </TableCell>
                      <TableCell>{runStatusBadge(run.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.startedAt} / {run.endedAt}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                        해당 상태의 실행이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Run Detail Drawer */}
      <Sheet open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">{selectedRun?.id}</SheetTitle>
            <SheetDescription className="text-xs">실행 상세 정보</SheetDescription>
          </SheetHeader>
          {selectedRun && (
            <div className="flex flex-col gap-5 px-4 pb-4">
              {/* Stepper */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">진행 단계</p>
                <div className="flex items-center gap-2">
                  <StepperProgress currentStep={selectedRun.step} status={selectedRun.status} />
                  <span className="text-xs text-muted-foreground ml-2">{selectedRun.step}</span>
                </div>
              </div>

              <Separator />

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">트리거</span>
                  <p className="text-foreground mt-0.5">{selectedRun.trigger}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">대상</span>
                  <p className="text-foreground mt-0.5">{selectedRun.target}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">시작</span>
                  <p className="text-foreground mt-0.5">{selectedRun.startedAt}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">종료</span>
                  <p className="text-foreground mt-0.5">{selectedRun.endedAt}</p>
                </div>
              </div>

              <Separator />

              {/* Artifacts summary */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">기록 수</span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {selectedRun.artifactCount}
                </Badge>
              </div>

              <Separator />

              {/* Logs */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">로그</p>
                <div className="rounded-lg bg-secondary/50 p-3 max-h-40 overflow-y-auto scrollbar-hide">
                  {selectedRun.logs.map((log, i) => (
                    <p key={i} className="font-mono text-[11px] text-muted-foreground leading-relaxed">{log}</p>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs">
                  <RotateCcw className="size-3 mr-1.5" />
                  재실행
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs text-red-500 hover:text-red-400">
                  <Square className="size-3 mr-1.5" />
                  실행 중단
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
                  <a href="/dashboard/artifacts">
                    <ExternalLink className="size-3 mr-1.5" />
                    기록
                  </a>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
