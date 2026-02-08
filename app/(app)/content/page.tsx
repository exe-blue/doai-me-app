"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"

function ContentTabs() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") === "channels" ? "channels" : "status"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">콘텐츠</h1>
        <p className="text-sm text-muted-foreground mt-1">
          콘텐츠 현황과 채널 등록.
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
              <CardTitle className="text-base">최근 24시간 업로드</CardTitle>
              <p className="text-sm text-muted-foreground">
                등록된 채널의 최근 영상. (YouTube API 연동 예정)
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                채널을 등록하면 여기에 영상 목록이 표시됩니다.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">채널 등록</CardTitle>
              <p className="text-sm text-muted-foreground">
                채널 URL 또는 channelId 입력 후 저장. (YouTube Data API v3 연동 예정)
              </p>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="channel">채널 URL 또는 channelId</Label>
                <Input
                  id="channel"
                  placeholder="https://youtube.com/channel/UC... 또는 UC..."
                  className="mt-2"
                />
              </div>
              <Button disabled>
                <Plus className="size-4 mr-2" />
                채널 추가
              </Button>
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
