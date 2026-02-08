"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Plus, Loader2 } from "lucide-react"

type CommandAsset = { id: string; title: string; asset_type: string }

type StepRow = {
  id?: string
  command_asset_id: string
  sort_order: number
  timeout_ms: number
  on_failure: string
  retry_count: number
  probability: number
}

export default function EditPlaybookPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [assets, setAssets] = useState<CommandAsset[]>([])
  const [steps, setSteps] = useState<StepRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch("/api/library/list").then((r) => r.json()),
      fetch(`/api/playbooks/${id}`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([libData, pb]) => {
      setAssets(libData.items ?? [])
      if (pb) {
        setName(pb.name ?? "")
        setDescription(pb.description ?? "")
        setSteps(
          (pb.steps ?? []).map((s: { id?: string; command_asset_id: string; sort_order: number; timeout_ms?: number; on_failure?: string; retry_count?: number; probability?: number }) => ({
            id: s.id,
            command_asset_id: s.command_asset_id,
            sort_order: s.sort_order ?? 0,
            timeout_ms: s.timeout_ms ?? 30000,
            on_failure: s.on_failure ?? "stop",
            retry_count: s.retry_count ?? 0,
            probability: Number(s.probability ?? 1),
          }))
        )
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const addStep = () => {
    const firstId = assets[0]?.id
    if (firstId) {
      setSteps((prev) => [
        ...prev,
        {
          command_asset_id: firstId,
          sort_order: prev.length,
          timeout_ms: 30000,
          on_failure: "stop",
          retry_count: 0,
          probability: 1,
        },
      ])
    }
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })))
  }

  const updateStep = (index: number, field: string, value: string | number) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const moveStep = (index: number, dir: "up" | "down") => {
    if (dir === "up" && index === 0) return
    if (dir === "down" && index >= steps.length - 1) return
    setSteps((prev) => {
      const next = [...prev]
      const j = dir === "up" ? index - 1 : index + 1
      ;[next[index], next[j]] = [next[j], next[index]]
      return next.map((s, i) => ({ ...s, sort_order: i }))
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch(`/api/playbooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        steps: steps.map((s) => ({
          command_asset_id: s.command_asset_id,
          sort_order: s.sort_order,
          timeout_ms: s.timeout_ms,
          on_failure: s.on_failure,
          retry_count: s.retry_count,
          probability: s.probability,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      router.refresh()
    } else {
      const err = await res.json()
      alert(err.error ?? "저장 실패")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="size-4 animate-spin" />
        로딩 중…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/playbooks">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playbook 편집</h1>
          <p className="text-muted-foreground text-sm mt-1">이름과 스텝을 수정하세요.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">이름 *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 부트스트랩 + 스크린샷" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">설명</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="선택" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">스텝</CardTitle>
          <Button variant="outline" size="sm" onClick={addStep} disabled={assets.length === 0}>
            <Plus className="size-4" />
            <span className="ml-2">스텝 추가</span>
          </Button>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">스텝을 추가하면 명령 라이브러리에서 선택할 수 있습니다.</p>
          ) : (
            <ul className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
                  <span className="text-muted-foreground w-6">{i + 1}.</span>
                  <Select
                    value={step.command_asset_id}
                    onValueChange={(v) => updateStep(i, "command_asset_id", v)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assets
                        .filter((a) => typeof a.id === "string" && a.id.trim().length > 0)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.title} ({a.asset_type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="timeout"
                    value={step.timeout_ms}
                    onChange={(e) => updateStep(i, "timeout_ms", Number(e.target.value) || 30000)}
                  />
                  <Select value={step.on_failure} onValueChange={(v) => updateStep(i, "on_failure", v)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stop">stop</SelectItem>
                      <SelectItem value="continue">continue</SelectItem>
                      <SelectItem value="retry">retry</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-16"
                    min={0}
                    value={step.retry_count}
                    onChange={(e) => updateStep(i, "retry_count", Number(e.target.value) || 0)}
                    title="retry"
                  />
                  <Input
                    type="number"
                    className="w-16"
                    min={0}
                    max={1}
                    step={0.1}
                    value={step.probability}
                    onChange={(e) => updateStep(i, "probability", Number(e.target.value) || 1)}
                    title="probability"
                  />
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="icon" onClick={() => moveStep(i, "up")} disabled={i === 0}>
                      ↑
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => moveStep(i, "down")} disabled={i === steps.length - 1}>
                      ↓
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)}>
                      ×
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            <span className="ml-2">저장</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
