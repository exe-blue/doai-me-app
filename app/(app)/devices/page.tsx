"use client"

import { useState, useEffect, useCallback } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DeviceHeatmap, type DeviceTileData } from "@/components/dashboard/device-heatmap"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Radio, Search, Wifi, WifiOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

const TILE_SIZE_MIN = 24
const TILE_SIZE_MAX = 56

type ApiDevice = {
  id: string
  device_id: string
  node_id: string | null
  last_seen_at: string | null
  last_error_message: string | null
  online: boolean
}

function useDevices(filter: string) {
  const [devices, setDevices] = useState<ApiDevice[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === "online") params.set("online_only", "true")
    const res = await fetch(`/api/devices?${params}`)
    const data = await res.json()
    let list = data.devices ?? []
    if (filter === "offline") list = list.filter((d: ApiDevice) => !d.online)
    setDevices(list)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filter === "online") params.set("online_only", "true")
    fetch(`/api/devices?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        let list = data.devices ?? []
        if (filter === "offline") list = list.filter((d: ApiDevice) => !d.online)
        setDevices(list)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  return { devices, loading, refresh }
}

export default function StatusPage() {
  const [filter, setFilter] = useState("all")
  const [indexSearch, setIndexSearch] = useState("")
  const [tileSize, setTileSize] = useState(36)
  const [selectedDevice, setSelectedDevice] = useState<DeviceTileData | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanIp, setScanIp] = useState("192.168.0.0/24")
  const [scanPorts, setScanPorts] = useState("5555")
  const [scanning, setScanning] = useState(false)

  const { devices, loading, refresh } = useDevices(filter)

  const filteredDevices = indexSearch.trim()
    ? devices.filter((_, i) => String(i + 1).includes(indexSearch.trim()))
    : devices
  const tiles: (DeviceTileData | null)[] = filteredDevices.slice(0, 100).map((d, i) => ({
    id: d.id,
    device_id: d.device_id,
    index: i + 1,
    online: d.online,
    runStatus: null,
  }))
  while (tiles.length < 100) tiles.push(null)

  const handleScan = async () => {
    setScanning(true)
    const res = await fetch("/api/nodes/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip_range: scanIp.trim(),
        ports: scanPorts.split(",").map((p) => parseInt(p.trim(), 10) || 5555),
      }),
    })
    setScanning(false)
    if (res.ok) {
      setScanOpen(false)
      toast.success("스캔 시작됨. 결과는 곧 반영됩니다.")
      refresh()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "스캔 실패")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
        <p className="text-muted-foreground text-sm mt-1">
          디바이스 Online/Offline 히트맵. 인덱스로 한눈에 맞춥니다.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="인덱스 검색"
                value={indexSearch}
                onChange={(e) => setIndexSearch(e.target.value)}
                className="w-24 h-8"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">타일</Label>
              <Slider
                value={[tileSize]}
                min={TILE_SIZE_MIN}
                max={TILE_SIZE_MAX}
                step={2}
                onValueChange={([v]) => setTileSize(v ?? 36)}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">{tileSize}px</span>
            </div>
            <Dialog open={scanOpen} onOpenChange={setScanOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Radio className="size-4" />
                  <span className="ml-2">스캔 시작</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>스캔 시작</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>IP 대역 (CIDR)</Label>
                    <Input
                      value={scanIp}
                      onChange={(e) => setScanIp(e.target.value)}
                      placeholder="192.168.0.0/24"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>포트 (쉼표)</Label>
                    <Input
                      value={scanPorts}
                      onChange={(e) => setScanPorts(e.target.value)}
                      placeholder="5555"
                    />
                  </div>
                  <Button onClick={handleScan} disabled={scanning}>
                    {scanning ? <Loader2 className="size-4 animate-spin" /> : null}
                    <span className="ml-2">시작</span>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={refresh}>
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground p-8">
                <Loader2 className="size-4 animate-spin" />
                로딩 중…
              </div>
            ) : (
              <DeviceHeatmap
                devices={tiles}
                tileSize={tileSize}
                onTileClick={(d) => setSelectedDevice(d)}
                selectedId={selectedDevice?.id}
              />
            )}
          </div>
          {selectedDevice && (
            <Card className="w-72 shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Device #{selectedDevice.index}</span>
                  <Badge variant={selectedDevice.online ? "default" : "destructive"} className="text-xs">
                    {selectedDevice.online ? (
                      <>
                        <Wifi className="size-3" />
                        <span className="ml-1">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="size-3" />
                        <span className="ml-1">Offline</span>
                      </>
                    )}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p className="text-muted-foreground">
                  device_id: {selectedDevice.device_id}
                </p>
                <p className="text-muted-foreground">
                  last_seen: {(devices.find((d) => d.id === selectedDevice.id) as ApiDevice | undefined)?.last_seen_at
                    ? new Date((devices.find((d) => d.id === selectedDevice.id) as ApiDevice).last_seen_at!).toLocaleString("ko-KR")
                    : "—"}
                </p>
                <p className="text-muted-foreground">
                  last_error: {(devices.find((d) => d.id === selectedDevice.id) as ApiDevice | undefined)?.last_error_message ?? "—"}
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
