"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  { label: "신규 콘텐츠", count: 3, icon: Play, color: "text-primary" },
  { label: "실행 대기", count: 7, icon: Clock, color: "text-amber-500" },
  { label: "활동 중 기기", count: 142, icon: Smartphone, color: "text-emerald-500" },
  { label: "업로드 완료 기록", count: 1284, icon: Upload, color: "text-blue-500" },
]

const recentRuns = [
  { id: "RUN-0047", trigger: "유튜브", target: "ALL", status: "완료", started: "14:32", link: "/dashboard/runs" },
  { id: "RUN-0046", trigger: "수동", target: "20대", status: "실행 중", started: "14:18", link: "/dashboard/runs" },
  { id: "RUN-0045", trigger: "유튜브", target: "ALL", status: "완료", started: "13:55", link: "/dashboard/runs" },
  { id: "RUN-0044", trigger: "유튜브", target: "20대", status: "실패", started: "13:22", link: "/dashboard/runs" },
  { id: "RUN-0043", trigger: "수동", target: "ALL", status: "완료", started: "12:50", link: "/dashboard/runs" },
  { id: "RUN-0042", trigger: "유튜브", target: "20대", status: "완료", started: "12:31", link: "/dashboard/runs" },
  { id: "RUN-0041", trigger: "유튜브", target: "ALL", status: "완료", started: "11:45", link: "/dashboard/runs" },
  { id: "RUN-0040", trigger: "수동", target: "20대", status: "완료", started: "11:12", link: "/dashboard/runs" },
  { id: "RUN-0039", trigger: "유튜브", target: "ALL", status: "완료", started: "10:58", link: "/dashboard/runs" },
  { id: "RUN-0038", trigger: "유튜브", target: "20대", status: "완료", started: "10:30", link: "/dashboard/runs" },
]

function statusBadge(status: string) {
  switch (status) {
    case "완료":
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{status}</Badge>
    case "실행 중":
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">{status}</Badge>
    case "실패":
      return <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function ConsolePage() {
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
                          <Link href={run.link}>
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
