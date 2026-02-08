"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

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

export default function RunDetailPage() {
  const params = useParams()
  const runId = params.runId as string
  const [run, setRun] = useState<RunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    fetch(`/api/runs/${runId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "실행을 찾을 수 없습니다." : "불러오기 실패")
        return res.json()
      })
      .then((data: RunSummary) => setRun(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [runId])

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
          <Link href="/dashboard/runs">의식 실행 목록</Link>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/runs">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">{run.run_id}</h1>
          <p className="text-sm text-muted-foreground">의식 실행 상세</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd>
                <Badge variant="secondary">{statusLabel[run.status] ?? run.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">레시피</dt>
              <dd className="font-mono">{run.workflow_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">트리거</dt>
              <dd>{run.trigger}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">범위</dt>
              <dd>{run.scope}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">총 성공 / 실패 / 타임아웃</dt>
              <dd>
                {run.totals.succeeded} / {run.totals.failed} / {run.totals.timeout}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-medium mb-2">노드별 요약</h2>
        <div className="flex flex-wrap gap-2">
          {run.nodes.map((n) => (
            <Card key={n.node_id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{n.node_id}</span>
                <Badge variant="outline" className="text-xs">
                  {n.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                성공 {n.summary.succeeded} / 실패 {n.summary.failed} / 타임아웃 {n.summary.timeout}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <Button variant="outline" asChild>
        <Link href="/dashboard/runs">의식 실행 목록으로</Link>
      </Button>
    </div>
  )
}
