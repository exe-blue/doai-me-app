"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Upload, Loader2, ChevronUp, ChevronDown, Play, Save } from "lucide-react"
import { toast } from "sonner"

type CommandAsset = {
  id: string
  title: string
  folder: string | null
  asset_type: string
  storage_path: string | null
  inline_content: string | null
  default_timeout_ms: number | null
  created_at: string
  updated_at: string
}

type BuilderStep = {
  asset: CommandAsset
  probability: number
  timeout_ms: number | null
  retry_count: number
  on_failure: "stop" | "continue" | "retry"
}

export default function LibraryPage() {
  const router = useRouter()
  const [items, setItems] = useState<CommandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [q, setQ] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("")
  const [folderFilter, setFolderFilter] = useState<string>("")
  const [selectedSteps, setSelectedSteps] = useState<BuilderStep[]>([])
  const [playbookName, setPlaybookName] = useState("")
  const [savePlaybookOpen, setSavePlaybookOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [runLoading, setRunLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (typeFilter) params.set("type", typeFilter)
    if (folderFilter) params.set("folder", folderFilter)
    if (q) params.set("q", q)
    const ac = new AbortController()
    queueMicrotask(() => setLoading(true))
    fetch(`/api/library/list?${params}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [typeFilter, folderFilter, q])

  const refreshList = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set("type", typeFilter)
    if (folderFilter) params.set("folder", folderFilter)
    if (q) params.set("q", q)
    fetch(`/api/library/list?${params}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false))
  }

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [formFolder, setFormFolder] = useState("")
  const [assetType, setAssetType] = useState("adb_script")
  const [description, setDescription] = useState("")
  const [defaultTimeoutMs, setDefaultTimeoutMs] = useState("30000")

  const handleUpload = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!file || !title.trim()) return
    setUploading(true)
    const formData = new FormData()
    formData.set("file", file)
    formData.set("title", title.trim())
    if (formFolder) formData.set("folder", formFolder)
    formData.set("asset_type", assetType)
    if (description) formData.set("description", description)
    if (defaultTimeoutMs) formData.set("default_timeout_ms", defaultTimeoutMs)
    const res = await fetch("/api/library/upload", { method: "POST", body: formData })
    setUploading(false)
    if (res.ok) {
      setFile(null)
      setTitle("")
      setFormFolder("")
      setDescription("")
      setDefaultTimeoutMs("30000")
      refreshList()
    } else {
      const err = await res.json()
      alert(err.error ?? "Upload failed")
    }
  }

  const selectedIds = new Set(selectedSteps.map((s) => s.asset.id))
  const toggleSelect = (asset: CommandAsset) => {
    setSelectedSteps((prev) => {
      const ids = new Set(prev.map((s) => s.asset.id))
      if (ids.has(asset.id)) return prev.filter((s) => s.asset.id !== asset.id)
      return [
        ...prev,
        {
          asset,
          probability: 100,
          timeout_ms: asset.default_timeout_ms,
          retry_count: 0,
          on_failure: "stop" as const,
        },
      ]
    })
  }
  const moveStep = (index: number, dir: "up" | "down") => {
    const next = index + (dir === "up" ? -1 : 1)
    if (next < 0 || next >= selectedSteps.length) return
    setSelectedSteps((prev) => {
      const copy = [...prev]
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
      return copy
    })
  }
  const updateStep = (index: number, patch: Partial<BuilderStep>) => {
    setSelectedSteps((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })
  }

  const buildStepsPayload = () =>
    selectedSteps.map((s, i) => ({
      command_asset_id: s.asset.id,
      sort_order: i,
      probability: s.probability / 100,
      timeout_ms: s.timeout_ms ?? undefined,
      retry_count: s.retry_count,
      on_failure: s.on_failure,
    }))

  const handleSavePlaybook = async () => {
    const name = playbookName.trim()
    if (!name) {
      toast.error("Playbook 이름을 입력하세요.")
      return
    }
    setSaveLoading(true)
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: null, steps: buildStepsPayload() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.id) {
        toast.success("Playbook이 저장되었습니다.")
        setSavePlaybookOpen(false)
        setPlaybookName("")
      } else {
        toast.error(data.error ?? "저장 실패")
      }
    } finally {
      setSaveLoading(false)
    }
  }

  const handleRunNow = async () => {
    if (selectedSteps.length === 0) {
      toast.error("명령을 1개 이상 선택하세요.")
      return
    }
    setRunLoading(true)
    try {
      const pbRes = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `실행 ${new Date().toISOString().slice(0, 19)}`,
          steps: buildStepsPayload(),
        }),
      })
      const pbData = await pbRes.json().catch(() => ({}))
      if (!pbRes.ok || !pbData.id) {
        toast.error(pbData.error ?? "Playbook 생성 실패")
        return
      }
      const runRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", scope: "ALL", playbook_id: pbData.id }),
      })
      const runData = await runRes.json().catch(() => ({}))
      if (runRes.ok && runData.run_id) {
        toast.success("실행을 생성했습니다.")
        router.push(`/runs/${runData.run_id}`)
      } else {
        toast.error(runData.error ?? "실행 생성 실패")
      }
    } finally {
      setRunLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">명령 라이브러리</h1>
        <p className="text-muted-foreground text-sm mt-1">
          ADB/JS 스크립트 업로드 및 목록. Playbook에서 참조합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">업로드</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-col gap-4 max-w-xl">
            <div className="grid gap-2">
              <Label htmlFor="file">파일</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.js,.json,.sh"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: ADB 부트스트랩"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="formFolder">폴더</Label>
              <Input
                id="formFolder"
                value={formFolder}
                onChange={(e) => setFormFolder(e.target.value)}
                placeholder="예: bootstrap"
              />
            </div>
            <div className="grid gap-2">
              <Label>타입</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adb_script">adb_script</SelectItem>
                  <SelectItem value="js">js</SelectItem>
                  <SelectItem value="json">json</SelectItem>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="vendor_action">vendor_action</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="선택"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeout">기본 타임아웃(ms)</Label>
              <Input
                id="timeout"
                type="number"
                value={defaultTimeoutMs}
                onChange={(e) => setDefaultTimeoutMs(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!file || !title.trim() || uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <span className="ml-2">업로드</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex gap-6 flex-wrap">
        <Card className="flex-1 min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Command Table</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Input
                placeholder="검색..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <Input
                placeholder="폴더"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="w-28"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="타입" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="adb_script">adb_script</SelectItem>
                  <SelectItem value="js">js</SelectItem>
                  <SelectItem value="json">json</SelectItem>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="vendor_action">vendor_action</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={refreshList}>
                새로고침
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="size-4 animate-spin" />
                로딩 중…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">선택</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>기본 Timeout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                        항목 없음. 위에서 업로드하세요.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => toggleSelect(row)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={() => toggleSelect(row)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell>{row.asset_type}</TableCell>
                        <TableCell>{row.folder ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {row.updated_at ? new Date(row.updated_at).toLocaleString("ko-KR") : "—"}
                        </TableCell>
                        <TableCell>{row.default_timeout_ms ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="w-96 shrink-0">
          <CardHeader>
            <CardTitle className="text-base">Selected Commands Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">왼쪽 테이블에서 명령을 선택하세요.</p>
            ) : (
              <>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {selectedSteps.map((step, index) => (
                    <div
                      key={step.asset.id}
                      className="rounded-lg border p-3 space-y-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{step.asset.title}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveStep(index, "up")}
                            disabled={index === 0}
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveStep(index, "down")}
                            disabled={index === selectedSteps.length - 1}
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </div>
                      </div>
                      {step.probability < 100 && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">p={step.probability}%</span>
                      )}
                      <div>
                        <Label className="text-xs">확률 (%)</Label>
                        <Slider
                          value={[step.probability]}
                          onValueChange={([v]) => updateStep(index, { probability: v })}
                          min={0}
                          max={100}
                          step={5}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">timeout override (ms)</Label>
                        <Input
                          type="number"
                          value={step.timeout_ms ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            updateStep(index, { timeout_ms: v ? Number(v) : null })
                          }}
                          placeholder="기본값"
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">retryCount</Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.retry_count}
                          onChange={(e) => updateStep(index, { retry_count: Number(e.target.value) || 0 })}
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">onFailure</Label>
                        <Select
                          value={step.on_failure}
                          onValueChange={(v: "stop" | "continue" | "retry") => updateStep(index, { on_failure: v })}
                        >
                          <SelectTrigger className="h-8 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stop">stop</SelectItem>
                            <SelectItem value="continue">continue</SelectItem>
                            <SelectItem value="retry">retry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => setSavePlaybookOpen(true)}
                    disabled={selectedSteps.length === 0}
                  >
                    <Save className="size-4 mr-2" />
                    Playbook 저장
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRunNow}
                    disabled={selectedSteps.length === 0 || runLoading}
                  >
                    {runLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
                    즉시 실행
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={savePlaybookOpen} onOpenChange={setSavePlaybookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Playbook 저장</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="playbook-name">이름</Label>
            <Input
              id="playbook-name"
              value={playbookName}
              onChange={(e) => setPlaybookName(e.target.value)}
              placeholder="예: 로그인 플로우"
            />
            <Button onClick={handleSavePlaybook} disabled={saveLoading}>
              {saveLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
