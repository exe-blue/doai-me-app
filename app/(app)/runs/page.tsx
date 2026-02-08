"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const STEP_KEYS = ["PREFLIGHT", "BOOTSTRAP", "LOGIN_FLOW", "SCREENSHOT", "UPLOAD"] as const
const STEP_TIMEOUT_SEC_MIN = 5
const STEP_TIMEOUT_SEC_MAX = 600
const DEFAULT_NODE_IDS = ["PC-01", "PC-02", "PC-03", "PC-04"]

type RunStatus = "대기열" | "실행 중" | "완료" | "실패" | "중단됨"
type RunStep = "관측" | "등록" | "배포" | "행동" | "기록"

const STEPS: RunStep[] = ["관측", "등록", "배포", "행동", "기록"]

interface ApiRun {
  id: string
  status: string
  trigger: string
  target: string
  started: string
}

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

const statusToRunStatus: Record<string, RunStatus> = {
  queued: "대기열",
  running: "실행 중",
  completed: "완료",
  completed_with_errors: "완료",
  failed: "실패",
}

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
  const router = useRouter()
  const [runs, setRuns] = useState<Run[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [tab, setTab] = useState("all")

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((list: ApiRun[] | { error?: string }) => {
        const arr = Array.isArray(list) ? list : []
        const mapped: Run[] = arr.map((r: ApiRun) => ({
          id: r.id,
          trigger: r.trigger ?? "manual",
          target: r.target ?? "ALL",
          step: "기록",
          status: statusToRunStatus[r.status] ?? "실패",
          startedAt: r.started ?? "—",
          endedAt: "—",
          artifactCount: 0,
          logs: [],
        }))
        setRuns(mapped)
      })
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false))
  }, [])

  const filtered = tab === "all" ? runs : runs.filter((r) => r.status === tabMap[tab])

  const [createOpen, setCreateOpen] = useState(false)
  const [workflows, setWorkflows] = useState<{ workflow_id: string; name: string }[]>([])
  const [workflowId, setWorkflowId] = useState("login_settings_screenshot_v1")
  const [nodeList, setNodeList] = useState<string[]>(DEFAULT_NODE_IDS)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(DEFAULT_NODE_IDS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [timeoutSec, setTimeoutSec] = useState<Record<string, string>>({
    PREFLIGHT: "",
    BOOTSTRAP: "",
    LOGIN_FLOW: "",
    SCREENSHOT: "",
    UPLOAD: "",
  })
  const [timeoutErrors, setTimeoutErrors] = useState<Record<string, string>>({})
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((d: { workflows?: { workflow_id: string; name: string }[] }) => {
        const list = d.workflows ?? []
        setWorkflows(list)
        if (list.length && !list.some((w) => w.workflow_id === workflowId)) {
          setWorkflowId(list[0].workflow_id)
        }
      })
      .catch(() => {})
  }, [workflowId])

  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => r.json())
      .then((d: { nodes?: { node_id: string }[] }) => {
        const ids = (d.nodes ?? []).map((n) => n.node_id)
        if (ids.length > 0) {
          setNodeList(ids)
          setSelectedNodeIds((prev) => {
            const intersection = prev.filter((id) => ids.includes(id))
            return prev.length === 0 || intersection.length === 0 ? ids : intersection
          })
        }
      })
      .catch(() => {})
  }, [])

  function validateTimeouts(): boolean {
    const err: Record<string, string> = {}
    if (showAdvanced) {
      for (const key of STEP_KEYS) {
        const raw = timeoutSec[key]?.trim()
        if (!raw) continue
        const n = Number.parseInt(raw, 10)
        if (Number.isNaN(n) || n < STEP_TIMEOUT_SEC_MIN || n > STEP_TIMEOUT_SEC_MAX) {
          err[key] = `${STEP_TIMEOUT_SEC_MIN}~${STEP_TIMEOUT_SEC_MAX}초 사이로 입력하세요.`
        }
      }
    }
    setTimeoutErrors(err)
    return Object.keys(err).length === 0
  }

  const handleCreateRun = async () => {
    if (selectedNodeIds.length === 0) {
      toast.error("실행할 노드를 한 개 이상 선택하세요.")
      return
    }
    if (!validateTimeouts()) return
    setSubmitLoading(true)
    const overridesMs: Record<string, number> = {}
    if (showAdvanced) {
      for (const key of STEP_KEYS) {
        const raw = timeoutSec[key]?.trim()
        if (!raw) continue
        const sec = Number.parseInt(raw, 10)
        if (!Number.isNaN(sec) && sec >= STEP_TIMEOUT_SEC_MIN && sec <= STEP_TIMEOUT_SEC_MAX) {
          overridesMs[key] = sec * 1000
        }
      }
    }
    const body: Record<string, unknown> = {
      trigger: "manual",
      scope: "ALL",
      workflow_id: workflowId,
      target: { node_ids: selectedNodeIds },
    }
    if (Object.keys(overridesMs).length > 0) body.timeoutOverrides = overridesMs
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.run_id) {
        setCreateOpen(false)
        toast.success("의식 실행이 생성되었습니다.")
        router.push(`/runs/${data.run_id}`)
        return
      }
      if (res.status === 400) {
        toast.error(data.error ?? "입력값을 확인해 주세요.")
        return
      }
      if (res.status === 401 || res.status === 403) {
        toast.error("권한이 없습니다.")
        return
      }
      toast.error("일시적인 오류가 났습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSubmitLoading(false)
    }
  }

  const toggleNode = (nodeId: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    )
  }
  const selectAllNodes = () => setSelectedNodeIds([...nodeList])
  const clearAllNodes = () => setSelectedNodeIds([])

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
              의식 실행 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>의식 실행 생성</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="workflowId">레시피(workflow)</Label>
                <select
                  id="workflowId"
                  aria-label="레시피(workflow) 선택"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {workflows.length > 0
                    ? workflows.map((w) => (
                        <option key={w.workflow_id} value={w.workflow_id}>
                          {w.name}
                        </option>
                      ))
                    : (
                      <>
                        <option value="bootstrap_only_v1">Bootstrap Only</option>
                        <option value="login_settings_screenshot_v1">Login → Settings → Screenshot</option>
                      </>
                    )}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>실행할 노드</Label>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllNodes}>
                      전체 선택
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllNodes}>
                      해제
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 rounded-md border border-input p-3 max-h-32 overflow-y-auto">
                  {nodeList.map((nodeId) => (
                    <label key={nodeId} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedNodeIds.includes(nodeId)}
                        onCheckedChange={() => toggleNode(nodeId)}
                      />
                      <span className="font-mono text-sm">{nodeId}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "고급 설정 접기" : "고급 설정"}
                </Button>
                {showAdvanced && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {STEP_KEYS.map((key) => (
                      <div key={key}>
                        <Label htmlFor={`timeout-${key}`} className="text-xs">{key} (초, {STEP_TIMEOUT_SEC_MIN}~{STEP_TIMEOUT_SEC_MAX})</Label>
                        <Input
                          id={`timeout-${key}`}
                          type="number"
                          min={STEP_TIMEOUT_SEC_MIN}
                          max={STEP_TIMEOUT_SEC_MAX}
                          placeholder="미지정"
                          value={timeoutSec[key] ?? ""}
                          onChange={(e) => {
                            setTimeoutSec((p) => ({ ...p, [key]: e.target.value }))
                            if (timeoutErrors[key]) setTimeoutErrors((p) => ({ ...p, [key]: "" }))
                          }}
                          className={cn("mt-1 h-8", timeoutErrors[key] && "border-destructive")}
                        />
                        {timeoutErrors[key] && (
                          <p className="text-xs text-destructive mt-0.5">{timeoutErrors[key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleCreateRun} disabled={submitLoading}>
                {submitLoading ? "생성 중…" : "생성"}
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
                  {runsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                        불러오는 중…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                        해당 상태의 실행이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/runs/${run.id}`)}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
