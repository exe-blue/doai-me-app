"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { RefreshCw, ExternalLink, Circle, Play } from "lucide-react"

type VideoStatus = "등록" | "대기" | "실행" | "완료" | "실패"

const channel = {
  name: "DoAi Official",
  status: "관측 중",
  lastCheck: "2분 전",
  pollInterval: "5분",
}

const videos: {
  id: string
  title: string
  uploadedAt: string
  status: VideoStatus
  runLink: string
}[] = [
  { id: "VID-301", title: "AI가 콘텐츠를 보는 방식에 대하여", uploadedAt: "14:22", status: "완료", runLink: "RUN-0047" },
  { id: "VID-300", title: "디지털 존재의 하루 루틴", uploadedAt: "13:10", status: "실행", runLink: "RUN-0046" },
  { id: "VID-299", title: "600대의 시선이 만드는 데이터", uploadedAt: "11:45", status: "완료", runLink: "RUN-0045" },
  { id: "VID-298", title: "자율 소비 네트워크 해부", uploadedAt: "09:30", status: "실패", runLink: "RUN-0044" },
  { id: "VID-297", title: "관측자와 피관측자 사이", uploadedAt: "어제 22:00", status: "완료", runLink: "RUN-0043" },
  { id: "VID-296", title: "MVP에서 배운 것들", uploadedAt: "어제 18:30", status: "대기", runLink: "—" },
  { id: "VID-295", title: "기기 사회 운영 보고 #12", uploadedAt: "어제 15:00", status: "등록", runLink: "—" },
]

function videoStatusBadge(status: VideoStatus) {
  const map: Record<VideoStatus, string> = {
    "등록": "bg-secondary text-secondary-foreground border-border",
    "대기": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "실행": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "완료": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "실패": "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return <Badge variant="secondary" className={map[status]}>{status}</Badge>
}

export default function VideosPage() {
  const [selectedVideo, setSelectedVideo] = useState<(typeof videos)[number] | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">콘텐츠 흐름</h1>
        <p className="text-sm text-muted-foreground mt-1">새 영상은 등록되고, 기기 사회에 관측이 전파됩니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Channel card */}
        <div className="lg:col-span-1">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-sm">관측 대상</CardTitle>
              <CardDescription className="text-xs">YouTube 채널</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{channel.name}</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                  <Circle className="size-1.5 fill-emerald-500 mr-1" />
                  {channel.status}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>마지막 확인</span>
                  <span className="text-foreground">{channel.lastCheck}</span>
                </div>
                <div className="flex justify-between">
                  <span>폴링 주기</span>
                  <span className="text-foreground">{channel.pollInterval}</span>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="w-full h-8 text-xs mt-2">
                <RefreshCw className="size-3 mr-1.5" />
                지금 확인
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Videos table */}
        <div className="lg:col-span-2">
          <Card className="py-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">제목</TableHead>
                    <TableHead className="text-xs">업로드 시각</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                    <TableHead className="text-xs">실행 링크</TableHead>
                    <TableHead className="text-xs text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow
                      key={video.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <TableCell className="text-xs max-w-[200px] truncate">{video.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{video.uploadedAt}</TableCell>
                      <TableCell>{videoStatusBadge(video.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{video.runLink}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <Play className="size-3 mr-1" />
                            실행(ALL)
                          </Button>
                          <span className="text-[9px] text-amber-500/70">ALL 실행은 권한자만.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-sm">{selectedVideo?.title}</SheetTitle>
            <SheetDescription className="text-xs">영상 상세 정보</SheetDescription>
          </SheetHeader>
          {selectedVideo && (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Video ID</span>
                  <span className="font-mono text-xs text-foreground">{selectedVideo.id}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">등록 시각</span>
                  <span className="text-xs text-foreground">{selectedVideo.uploadedAt}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">마지막 실행</span>
                  <span className="font-mono text-xs text-foreground">{selectedVideo.runLink}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">상태</span>
                  {videoStatusBadge(selectedVideo.status)}
                </div>
              </div>
              <Button variant="secondary" size="sm" className="w-full h-8 text-xs mt-2">
                <ExternalLink className="size-3 mr-1.5" />
                관련 기록 보기
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
