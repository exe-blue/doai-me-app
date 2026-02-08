"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Loader2, Zap, Cable, Box, Search } from "lucide-react"
import { toast } from "sonner"

type Playbook = { id: string; name: string; description: string | null }

const CHECKLIST = [
  { label: "OTG 허브/케이블", done: false },
  { label: "전원/충전", done: false },
  { label: "같은 내부망(IP 대역)", done: false },
  { label: "USB 디버깅/개발자 옵션", done: false },
]

const OTG_STEPS = [
  "기기를 PC 또는 허브에 USB로 연결합니다.",
  "‘USB 디버깅 허용’ 팝업이 뜨면 확인을 누릅니다.",
  "같은 네트워크에서 ADB over network 사용 시: `adb tcpip 5555` 후 기기 IP:5555로 연결.",
]

const FAQ = [
  { q: "인식 안 됨", a: "케이블/허브 교체, 개발자 옵션 → USB 디버깅 확인, 다른 포트 시도." },
  { q: "충전만 됨", a: "데이터 지원 케이블인지 확인. 일부 케이블은 충전 전용입니다." },
  { q: "adb devices에 안 뜸", a: "USB 디버깅 허용, 드라이버 설치(Windows), udev 규칙(Linux)." },
]

export default function OnboardingPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [scanIp, setScanIp] = useState("192.168.0.0/24")
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetch("/api/playbooks")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const items = (data.items ?? []).filter((p: Playbook) =>
          p.name?.includes("온보딩 프리셋")
        )
        setPlaybooks(items)
        setLoading(false)
      })
  }, [])

  const runPreset = (playbookId: string) => {
    setRunningId(playbookId)
    fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbook_id: playbookId,
        scope: "ALL",
        trigger: "manual",
      }),
    })
      .then((r) => {
        if (r.ok) return r.json()
        return r.json().then((j) => Promise.reject(new Error(j.error ?? "실행 실패")))
      })
      .then((d) => {
        toast.success(`실행 생성됨. run_id: ${d.run_id ?? "-"}`)
        window.location.href = "/runs"
      })
      .catch((e) => {
        toast.error(e.message ?? "실행 실패")
        setRunningId(null)
      })
  }

  const startScan = () => {
    if (!scanIp.trim()) return
    setScanning(true)
    fetch("/api/nodes/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip_range: scanIp.trim(), ports: [5555] }),
    })
      .then((r) => {
        if (r.ok) return r.json()
        return r.json().then((j) => Promise.reject(new Error(j.error ?? "스캔 실패")))
      })
      .then(() => {
        toast.success("스캔 요청됨. 발견되면 자동 등록됩니다.")
      })
      .catch((e) => {
        toast.error(e.message ?? "스캔 실패")
      })
      .finally(() => setScanning(false))
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">노드 온보딩</h1>
        <p className="text-sm text-muted-foreground mt-1">
          준비물 · OTG 연결 · ADB 프리셋 · 스캔
        </p>
      </div>

      {/* 1. 준비물 체크리스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="size-4" />
            준비물 체크리스트
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHECKLIST.map((item) => (
            <label key={item.label} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-muted-foreground" />
              <span>{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* 2. 연결 방법(OTG) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cable className="size-4" />
            연결 방법 (OTG)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            {OTG_STEPS.map((step) => (
              <li key={step.slice(0, 48)}>{step}</li>
            ))}
          </ol>
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-foreground mb-2">자주 묻는 질문</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {FAQ.map((faq) => (
                <li key={faq.q}>
                  <span className="font-medium text-foreground">{faq.q}</span> — {faq.a}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 3. ADB 프리셋 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" />
            ADB 프리셋 (실행)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Online 기기 대상으로 Playbook을 실행합니다. 대상은 실행 목록에서 확인하세요.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> 로딩 중…
            </p>
          ) : playbooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              프리셋이 없습니다. DB 시드(온보딩 프리셋)를 적용한 뒤 새로고침하세요.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {playbooks.map((pb) => (
                <Button
                  key={pb.id}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-start gap-1"
                  disabled={runningId !== null}
                  onClick={() => runPreset(pb.id)}
                >
                  <span className="font-medium">{pb.name}</span>
                  {pb.description && (
                    <span className="text-xs text-muted-foreground font-normal">{pb.description}</span>
                  )}
                  {runningId === pb.id && <Loader2 className="size-4 animate-spin mt-1" />}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. 스캔 시작 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="size-4" />
            스캔 시작
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            IP 대역을 입력하고 스캔하면 발견된 기기가 자동 등록됩니다.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Label htmlFor="ip_range" className="sr-only">IP 대역</Label>
            <Input
              id="ip_range"
              placeholder="192.168.0.0/24"
              value={scanIp}
              onChange={(e) => setScanIp(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={startScan} disabled={scanning}>
              {scanning ? <Loader2 className="size-4 animate-spin" /> : "스캔 시작"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">발견되면 자동 등록됩니다.</p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/devices" className="underline hover:no-underline">기기 화면</Link>
        {" · "}
        <Link href="/runs" className="underline hover:no-underline">실행 목록</Link>
      </p>
    </div>
  )
}
