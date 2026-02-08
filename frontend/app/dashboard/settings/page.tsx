"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ShieldAlert, Database, Lock, Bell } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">설정/권한</h1>
        <p className="text-sm text-muted-foreground mt-1">시스템 구성과 접근 권한.</p>
      </div>

      {/* Warning card */}
      <Card className="border-amber-500/20 bg-amber-500/5 py-4 gap-3">
        <CardHeader className="px-4 py-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-500" />
            <CardTitle className="text-sm text-amber-500">주의</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">
            ALL 실행은 실수의 반경이 큽니다. 이 기능은 잠금 상태가 기본입니다.
          </p>
        </CardContent>
      </Card>

      {/* 권한 */}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">권한</CardTitle>
          </div>
          <CardDescription className="text-xs">실행 권한 및 사용자 역할 관리</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">ALL 실행 권한</p>
              <p className="text-xs text-muted-foreground mt-0.5">ALL 실행은 권한자만.</p>
              <p className="text-xs text-amber-500/80 mt-0.5">기본 잠금 상태입니다.</p>
            </div>
            <Switch defaultChecked={false} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">사용자 역할</p>
              <p className="text-xs text-muted-foreground mt-0.5">현재 역할을 확인하거나 변경</p>
            </div>
            <Select defaultValue="operator">
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">뷰어</SelectItem>
                <SelectItem value="operator">운영자</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 저장소 */}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">저장소</CardTitle>
          </div>
          <CardDescription className="text-xs">중앙 저장소 연결 상태</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">중앙 저장소</p>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
              연결됨
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 보안 */}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">보안</CardTitle>
          </div>
          <CardDescription className="text-xs">감사 로그 및 보안 설정</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">실행 감사 로그</p>
              <p className="text-xs text-muted-foreground mt-0.5">모든 실행 기록을 감사 로그에 저장</p>
            </div>
            <Switch defaultChecked={true} />
          </div>
        </CardContent>
      </Card>

      {/* 알림 */}
      <Card className="gap-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">알림</CardTitle>
          </div>
          <CardDescription className="text-xs">실패 시 알림 채널 설정</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Email 알림</p>
              <p className="text-xs text-muted-foreground mt-0.5">실패 발생 시 이메일 전송</p>
            </div>
            <Switch defaultChecked={true} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Slack 알림</p>
              <p className="text-xs text-muted-foreground mt-0.5">Slack 채널에 실패 알림</p>
            </div>
            <Badge variant="outline" className="text-[10px]">미연결</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
