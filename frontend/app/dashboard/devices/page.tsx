"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Lock, Camera, LogIn, Eye } from "lucide-react"

const summaryCards = [
  { label: "활성", count: 142, color: "text-emerald-500 bg-emerald-500/10" },
  { label: "침묵", count: 38, color: "text-amber-500 bg-amber-500/10" },
  { label: "활동 중", count: 12, color: "text-blue-500 bg-blue-500/10" },
  { label: "이탈", count: 8, color: "text-red-500 bg-red-500/10" },
]

type DeviceStatus = "활성" | "침묵" | "활동 중" | "이탈"

const devices: {
  id: string
  host: string
  status: DeviceStatus
  lastSeen: string
  network: string
  action: string
}[] = [
  { id: "DEV-001", host: "kvm-node-a-01", status: "활성", lastSeen: "2분 전", network: "LTE-A", action: "관측 대기" },
  { id: "DEV-002", host: "kvm-node-a-02", status: "활동 중", lastSeen: "지금", network: "LTE-A", action: "스크린샷 수집" },
  { id: "DEV-003", host: "kvm-node-a-03", status: "활성", lastSeen: "1분 전", network: "Wi-Fi", action: "관측 대기" },
  { id: "DEV-004", host: "kvm-node-b-01", status: "침묵", lastSeen: "12분 전", network: "LTE-B", action: "—" },
  { id: "DEV-005", host: "kvm-node-b-02", status: "활성", lastSeen: "30초 전", network: "LTE-B", action: "업로드 중" },
  { id: "DEV-006", host: "kvm-node-b-03", status: "이탈", lastSeen: "2시간 전", network: "—", action: "—" },
  { id: "DEV-007", host: "kvm-node-a-04", status: "활성", lastSeen: "45초 전", network: "LTE-A", action: "관측 대기" },
  { id: "DEV-008", host: "kvm-node-a-05", status: "활동 중", lastSeen: "지금", network: "Wi-Fi", action: "접근성 입력" },
]

function deviceStatusBadge(status: DeviceStatus) {
  const map: Record<DeviceStatus, string> = {
    "활성": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "침묵": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "활동 중": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "이탈": "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return <Badge variant="secondary" className={map[status]}>{status}</Badge>
}

export default function DevicesPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("all")

  const filtered = devices.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">기기 사회</h1>
        <p className="text-sm text-muted-foreground mt-1">각 기기는 하나의 관측 지점입니다.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label} className="py-4 gap-2">
            <CardContent className="px-4 flex items-center gap-3">
              <div className={`flex size-9 items-center justify-center rounded-lg ${c.color}`}>
                <span className="text-sm font-bold">{c.count}</span>
              </div>
              <span className="text-sm text-muted-foreground">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="활성">활성</SelectItem>
            <SelectItem value="침묵">침묵</SelectItem>
            <SelectItem value="활동 중">활동 중</SelectItem>
            <SelectItem value="이탈">이탈</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="태그/그룹" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="not-tagged">Not Tagged</SelectItem>
            <SelectItem value="node-a">Node A</SelectItem>
            <SelectItem value="node-b">Node B</SelectItem>
          </SelectContent>
        </Select>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 opacity-50">
                <Switch disabled className="scale-90" />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3" />
                  ALL 실행
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>ALL 실행은 권한자만. 기본 잠금 상태입니다.</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs">
            전체 의식 실행(ALL)
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-xs">
            전체 기록 수집(ALL)
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-amber-500/80 -mt-4">ALL 실행은 권한자만. 기본 잠금 상태입니다.</p>

      {/* Device table */}
      <Card className="py-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">기기 ID</TableHead>
                <TableHead className="text-xs">호스트</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">마지막 호흡</TableHead>
                <TableHead className="text-xs">네트워크</TableHead>
                <TableHead className="text-xs">행동</TableHead>
                <TableHead className="text-xs text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.id}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{d.host}</TableCell>
                  <TableCell>{deviceStatusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.lastSeen}</TableCell>
                  <TableCell className="text-xs">{d.network}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.action}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7">
                        <LogIn className="size-3.5" />
                        <span className="sr-only">접근성 입력 (ID/PW/버튼)</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7">
                        <Camera className="size-3.5" />
                        <span className="sr-only">기기별로 저장 (스크린샷)</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7">
                        <Eye className="size-3.5" />
                        <span className="sr-only">기록 보기</span>
                      </Button>
                    </div>
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
