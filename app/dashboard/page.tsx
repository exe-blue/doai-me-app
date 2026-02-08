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
import { Play, Clock, Smartphone, Upload, ExternalLink, ShieldAlert } from "lucide-react"
import Link from "next/link"

const flowCards = [
  { label: "신규 콘텐츠", count: "—", icon: Play, color: "text-primary" },
  { label: "실행 대기", count: "—", icon: Clock, color: "text-amber-500" },
  { label: "활동 중 기기", count: "—", icon: Smartphone, color: "text-emerald-500" },
  { label: "업로드 완료 기록", count: "—", icon: Upload, color: "text-blue-500" },
]

type RunRow = { id: string; trigger: string; target: string; status: string; started: string }

function statusBadge(status: string) {
  switch (status) {
    case "completed":
    case "완료":
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{status === "completed" ? "완료" : status}</Badge>
    case "running":
    case "실행 중":
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{status === "running" ? "실행 중" : status}</Badge>
    case "failed":
    case "실패":
      return <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">{status === "failed" ? "실패" : status}</Badge>
    case "queued":
    case "대기열":
      return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">{status === "queued" ? "대기열" : status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function ConsolePage() {
  const [recentRuns, setRecentRuns] = useState<RunRow[]>([])

  useEffect(() => {
    fetch("/api/runs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RunRow[]) => setRecentRuns(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">콘솔 홈</h1>
        <p className="text-sm text-muted-foreground mt-1">관측과 실행의 현재 상태.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: 오늘의 흐름 */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">오늘의 흐름</h2>
          <div className="grid grid-cols-2 gap-3">
            {flowCards.map((card) => (
              <Card key={card.label} className="py-4 gap-3">
                <CardContent className="px-4">
                  <div className="flex items-center gap-2">
                    <card.icon className={`size-4 ${card.color}`} />
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{card.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 가드레일 callout */}
          <Card className="border-amber-500/20 bg-amber-500/5 py-4 gap-3">
            <CardHeader className="px-4 py-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-500" />
                <CardTitle className="text-sm text-amber-500">가드레일</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">ALL 실행은 권한자만.</p>
              <p className="text-xs text-muted-foreground">기본 잠금 상태입니다.</p>
              <p className="text-xs text-muted-foreground">20대 기준, 5 스프린트 확장.</p>
            </CardContent>
          </Card>
        </div>

        {/* Right: 최근 의식 실행 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">최근 의식 실행</h2>
          <Card className="py-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">실행 ID</TableHead>
                    <TableHead className="text-xs">트리거</TableHead>
                    <TableHead className="text-xs">대상</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                    <TableHead className="text-xs">시작 시각</TableHead>
                    <TableHead className="text-xs w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">{run.id}</TableCell>
                      <TableCell className="text-xs">{run.trigger}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{run.target}</Badge>
                      </TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{run.started}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="size-6" asChild>
                          <Link href={`/dashboard/runs/${run.id}`}>
                            <ExternalLink className="size-3" />
                            <span className="sr-only">실행 상세 보기</span>
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
      </div>
    </div>
  )
}
