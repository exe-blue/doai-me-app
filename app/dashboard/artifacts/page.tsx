"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Grid3X3, List, Download, RotateCcw, ExternalLink } from "lucide-react"
import { ImageIcon } from "lucide-react"

type ArtifactStatus = "업로드 완료" | "업로드 중" | "실패"

interface Artifact {
  id: string
  videoId: string
  deviceId: string
  runId: string
  status: ArtifactStatus
  uploadedAt: string
  originUrl: string
  deviceMeta: string
}

const artifacts: Artifact[] = [
  { id: "ART-1001", videoId: "VID-301", deviceId: "DEV-001", runId: "RUN-0047", status: "업로드 완료", uploadedAt: "14:55", originUrl: "s3://doai-artifacts/1001.png", deviceMeta: "kvm-node-a-01 / LTE-A" },
  { id: "ART-1002", videoId: "VID-301", deviceId: "DEV-002", runId: "RUN-0047", status: "업로드 완료", uploadedAt: "14:56", originUrl: "s3://doai-artifacts/1002.png", deviceMeta: "kvm-node-a-02 / LTE-A" },
  { id: "ART-1003", videoId: "VID-301", deviceId: "DEV-003", runId: "RUN-0047", status: "업로드 중", uploadedAt: "—", originUrl: "—", deviceMeta: "kvm-node-a-03 / Wi-Fi" },
  { id: "ART-1004", videoId: "VID-300", deviceId: "DEV-005", runId: "RUN-0046", status: "업로드 완료", uploadedAt: "14:32", originUrl: "s3://doai-artifacts/1004.png", deviceMeta: "kvm-node-b-02 / LTE-B" },
  { id: "ART-1005", videoId: "VID-300", deviceId: "DEV-007", runId: "RUN-0046", status: "실패", uploadedAt: "—", originUrl: "—", deviceMeta: "kvm-node-a-04 / LTE-A" },
  { id: "ART-1006", videoId: "VID-299", deviceId: "DEV-001", runId: "RUN-0045", status: "업로드 완료", uploadedAt: "12:08", originUrl: "s3://doai-artifacts/1006.png", deviceMeta: "kvm-node-a-01 / LTE-A" },
  { id: "ART-1007", videoId: "VID-299", deviceId: "DEV-008", runId: "RUN-0045", status: "업로드 완료", uploadedAt: "12:09", originUrl: "s3://doai-artifacts/1007.png", deviceMeta: "kvm-node-a-05 / Wi-Fi" },
  { id: "ART-1008", videoId: "VID-298", deviceId: "DEV-004", runId: "RUN-0044", status: "실패", uploadedAt: "—", originUrl: "—", deviceMeta: "kvm-node-b-01 / LTE-B" },
]

function artifactStatusBadge(status: ArtifactStatus) {
  const map: Record<ArtifactStatus, string> = {
    "업로드 완료": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "업로드 중": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "실패": "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return <Badge variant="secondary" className={map[status]}>{status}</Badge>
}

export default function ArtifactsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<Artifact | null>(null)

  const filtered = artifacts.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">기록 보관소</h1>
        <p className="text-sm text-muted-foreground mt-1">기기별로 저장 후, 중앙 저장소 업로드.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="videoId" className="h-8 w-28 text-xs" />
        <Input placeholder="deviceId" className="h-8 w-28 text-xs" />
        <Input type="date" className="h-8 w-36 text-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="업로드 완료">업로드 완료</SelectItem>
            <SelectItem value="업로드 중">업로드 중</SelectItem>
            <SelectItem value="실패">실패</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="size-4" />
            <span className="sr-only">그리드 보기</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
            <span className="sr-only">리스트 보기</span>
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((art) => (
            <Card
              key={art.id}
              className="cursor-pointer py-0 gap-0 overflow-hidden hover:ring-1 hover:ring-primary/30 transition-all"
              onClick={() => setSelected(art)}
            >
              <div className="aspect-video bg-secondary/50 flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground/30" />
              </div>
              <CardContent className="p-3 flex flex-col gap-1">
                <p className="font-mono text-[10px] text-muted-foreground">{art.id}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{art.deviceId}</span>
                  {artifactStatusBadge(art.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card className="py-0 gap-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">기록 ID</TableHead>
                  <TableHead className="text-xs">콘텐츠 ID</TableHead>
                  <TableHead className="text-xs">기기 ID</TableHead>
                  <TableHead className="text-xs">실행 ID</TableHead>
                  <TableHead className="text-xs">상태</TableHead>
                  <TableHead className="text-xs">업로드 시각</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((art) => (
                  <TableRow
                    key={art.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(art)}
                  >
                    <TableCell className="font-mono text-xs">{art.id}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{art.videoId}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{art.deviceId}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{art.runId}</TableCell>
                    <TableCell>{artifactStatusBadge(art.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{art.uploadedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-mono text-sm">{selected?.id}</SheetTitle>
            <SheetDescription className="text-xs">기록 상세</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="aspect-video rounded-lg bg-secondary/50 flex items-center justify-center">
                <ImageIcon className="size-12 text-muted-foreground/20" />
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">원본 링크(중앙 저장소)</span>
                  <span className="font-mono text-[10px] text-foreground max-w-[200px] truncate">{selected.originUrl}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기기별 저장 정보</span>
                  <span className="font-mono text-[10px] text-foreground">{selected.deviceMeta}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">실행 ID</span>
                  <span className="font-mono text-[10px] text-foreground">{selected.runId}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">업로드 시각</span>
                  <span className="text-foreground">{selected.uploadedAt}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs">
                  <Download className="size-3 mr-1.5" />
                  다운로드
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs">
                  <RotateCcw className="size-3 mr-1.5" />
                  다시 업로드
                </Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs" asChild>
                  <Link href="/dashboard/runs">
                    <ExternalLink className="size-3 mr-1.5" />
                    실행
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
