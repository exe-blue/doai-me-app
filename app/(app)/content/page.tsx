"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useCallback, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Loader2, RefreshCw } from "lucide-react"
import Image from "next/image"

type ContentItem = {
  content_id: string
  title: string | null
  channel: { channel_id: string | null; title: string | null }
  published_at: string | null
  thumbnail_url: string | null
  status: string
  run_id: string | null
}

type ChannelRow = {
  id: string
  channel_id: string
  title: string | null
  thumbnail_url: string | null
  last_sync_at: string | null
  new_24h: number
  latest_published_at: string | null
}

function ContentTabs() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") === "channels" ? "channels" : "status"

  const [statusFilter, setStatusFilter] = useState<string>("__all__")
  const [channelFilter, setChannelFilter] = useState<string | undefined>(undefined)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [runCreating, setRunCreating] = useState<string | null>(null)

  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelSort, setChannelSort] = useState<"alpha" | "recent">("alpha")
  const [addChannelInput, setAddChannelInput] = useState("")
  const [addChannelLoading, setAddChannelLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState<string | null>(null)

  const fetchContent = useCallback(() => {
    const params = new URLSearchParams({ window: "24" })
    if (statusFilter && statusFilter !== "__all__") params.set("status", statusFilter)
    if (channelFilter) params.set("channel_id", channelFilter)
    return fetch(`/api/content/status?${params}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json) => setContentItems(json.items ?? []))
  }, [statusFilter, channelFilter])

  const fetchChannels = useCallback(() => {
    return fetch(`/api/channels?sort=${channelSort}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json) => setChannels(json.items ?? []))
  }, [channelSort])

  useEffect(() => {
    if (tab !== "status") return
    let cancelled = false
    queueMicrotask(() => setContentLoading(true))
    fetchContent().finally(() => { if (!cancelled) setContentLoading(false) })
    return () => { cancelled = true }
  }, [tab, fetchContent])

  useEffect(() => {
    if (tab !== "channels") return
    let cancelled = false
    queueMicrotask(() => setChannelsLoading(true))
    fetchChannels().finally(() => { if (!cancelled) setChannelsLoading(false) })
    return () => { cancelled = true }
  }, [tab, fetchChannels])

  useEffect(() => {
    if (tab !== "status") return
    fetchChannels()
  }, [tab, fetchChannels])

  const handleRunCreate = (contentId: string) => {
    setRunCreating(contentId)
    fetch("/api/content/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_id: contentId,
        workflow_id: "demo_20steps_v1",
        params: {},
        target: { scope: "ALL" },
      }),
    })
      .then((r) => {
        if (r.ok) {
          fetchContent()
          return r.json().then((d) => d.run_id)
        }
        throw new Error("Run create failed")
      })
      .then((runId) => {
        if (runId) window.location.href = `/runs?highlight=${runId}`
      })
      .finally(() => setRunCreating(null))
  }

  const handleAddChannel = () => {
    const v = addChannelInput.trim()
    if (!v) return
    setAddChannelLoading(true)
    fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "youtube", channel_url_or_id: v }),
    })
      .then((r) => {
        if (r.ok) {
          setAddChannelInput("")
          fetchChannels()
        } else return r.json().then((j) => { throw new Error(j.error ?? "Failed"); })
      })
      .finally(() => setAddChannelLoading(false))
  }

  const handleSync = (channelId: string) => {
    setSyncLoading(channelId)
    fetch(`/api/channels/${channelId}/sync`, { method: "POST" })
      .then((r) => { if (!r.ok) throw new Error("Sync failed"); return fetchChannels(); })
      .finally(() => setSyncLoading(null))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">콘텐츠</h1>
        <p className="text-sm text-muted-foreground mt-1">
          현황(메인) · 채널 관리(서브)
        </p>
      </div>

      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="status" asChild>
            <Link href="/content">콘텐츠 현황</Link>
          </TabsTrigger>
          <TabsTrigger value="channels" asChild>
            <Link href="/content?tab=channels">채널 등록</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 24시간</CardTitle>
              <div className="flex flex-wrap gap-3 mt-2">
                <Select value={statusFilter || "__all__"} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">등록됨(New)</SelectItem>
                    <SelectItem value="done">완료됨(Done)</SelectItem>
                    <SelectItem value="__all__">전체</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={channelFilter || "__all__"} onValueChange={(v) => setChannelFilter(v === "__all__" ? undefined : v)}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue placeholder="채널" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">전체</SelectItem>
                    {channels
                      .filter((c) => typeof c.id === "string" && c.id.trim().length > 0)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id || "__unknown__"}>
                          {c.title || c.channel_id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {contentLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> 로딩 중…
                </p>
              ) : contentItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  등록된 채널의 영상이 없습니다. 채널을 추가한 뒤 동기화하세요.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {contentItems.map((item) => (
                    <Card key={item.content_id} className="overflow-hidden">
                      <div className="aspect-video bg-muted relative">
                        {item.thumbnail_url && (
                          <Image
                            src={item.thumbnail_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground truncate">
                          {item.channel?.title ?? item.channel?.channel_id ?? "—"}
                        </p>
                        <p className="text-sm font-medium truncate" title={item.title ?? ""}>
                          {item.title ?? item.content_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.published_at
                            ? new Date(item.published_at).toLocaleString("ko-KR")
                            : "—"}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {item.status === "done" ? "Done" : "New"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={item.status === "done" || runCreating !== null}
                            onClick={() => handleRunCreate(item.content_id)}
                          >
                            {runCreating === item.content_id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "실행 생성"
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">채널 관리</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="채널 ID 또는 URL (UC...)"
                    className="w-48 h-8 text-sm"
                    value={addChannelInput}
                    onChange={(e) => setAddChannelInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                  />
                  <Button
                    size="sm"
                    disabled={!addChannelInput.trim() || addChannelLoading}
                    onClick={handleAddChannel}
                  >
                    {addChannelLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 mr-2" />}
                    채널 추가
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                기본 정렬: 가나다순. 필요 시 최근 업데이트 순 토글.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-xs">정렬</Label>
                <Select
                  value={channelSort}
                  onValueChange={(v) => setChannelSort(v as "alpha" | "recent")}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alpha">가나다순</SelectItem>
                    <SelectItem value="recent">최근 업데이트 순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {channelsLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> 로딩 중…
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">채널명</TableHead>
                      <TableHead className="text-xs">채널 ID</TableHead>
                      <TableHead className="text-xs">최근 업로드</TableHead>
                      <TableHead className="text-xs">24h 신규</TableHead>
                      <TableHead className="text-xs">동기화</TableHead>
                      <TableHead className="text-xs w-24">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                          채널 없음. 채널 ID(UC...) 또는 URL 입력 후 채널 추가로 등록하세요.
                        </TableCell>
                      </TableRow>
                    ) : (
                      channels.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">
                            <span className="font-medium">{c.title || "—"}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{c.channel_id}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.latest_published_at
                              ? new Date(c.latest_published_at).toLocaleString("ko-KR")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{c.new_24h}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              disabled={syncLoading !== null}
                              onClick={() => handleSync(c.id)}
                            >
                              {syncLoading === c.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">로딩 중…</div>}>
      <ContentTabs />
    </Suspense>
  )
}
