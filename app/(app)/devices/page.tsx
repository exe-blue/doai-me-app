"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/lib/api";
import { POLL_INTERVAL_DEVICES_MS } from "@/lib/constants";
import { toDevicesVM } from "@/lib/viewmodels/devicesVM";
import { DeviceHeatmap } from "@/components/DeviceHeatmap";
import { HeatmapSkeleton } from "@/components/Skeleton";
import { normalizeToSlots } from "@/lib/heatmap";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wifi, WifiOff, Radio } from "lucide-react";
import { toast } from "sonner";

function parseSel(sel: string | null): number | null {
  if (!sel) return null;
  const n = Number.parseInt(sel, 10);
  return Number.isNaN(n) ? null : n;
}

function DevicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const nodeParam = searchParams.get("node");
  const selFromUrl = searchParams.get("sel");
  const selectedIndex = parseSel(selFromUrl);
  const [indexSearch, setIndexSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanIp, setScanIp] = useState("192.168.0.0/24");
  const [scanPorts, setScanPorts] = useState("5555");
  const [scanning, setScanning] = useState(false);

  const { data: raw, loading, refetch } = usePolling<unknown>(
    "/api/nodes/status",
    POLL_INTERVAL_DEVICES_MS,
    { enabled: true }
  );

  const vm = toDevicesVM(raw as Parameters<typeof toDevicesVM>[0]);
  const allItems = vm?.heatmapItems ?? [];
  const tileSize = 36;

  const { displayItems, selectedItem } = useMemo(() => {
    let filtered = allItems;
    if (nodeParam) filtered = filtered.filter((i) => (i.node_id ?? "") === nodeParam);
    if (filterParam === "online") filtered = filtered.filter((i) => i.online);
    if (filterParam === "offline") filtered = filtered.filter((i) => !i.online);
    const items = nodeParam ? normalizeToSlots(filtered, 100) : filtered;
    const selected = selectedIndex != null ? items.find((i) => i.index === selectedIndex) : null;
    return { displayItems: items, selectedItem: selected };
  }, [allItems, nodeParam, filterParam, selectedIndex]);

  const setSelectedIndex = (index: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sel", String(index));
    if (nodeParam) url.searchParams.set("node", nodeParam);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleScan = async () => {
    setScanning(true);
    const res = await fetch("/api/nodes/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip_range: scanIp.trim(),
        ports: scanPorts.split(",").map((p) => Number.parseInt(p.trim(), 10) || 5555),
      }),
    });
    setScanning(false);
    if (res.ok) {
      setScanOpen(false);
      toast.success("스캔 시작됨. 결과는 곧 반영됩니다.");
      refetch();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "스캔 실패");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">기기</h1>
        <p className="text-muted-foreground text-sm mt-1">
          디바이스 Online/Offline 히트맵. 인덱스로 한눈에 맞춥니다.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2"
        >
          <Radio className="size-3.5" />
          온보딩 바로가기
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="인덱스 검색"
                value={indexSearch}
                onChange={(e) => setIndexSearch(e.target.value)}
                className="w-24 h-8"
              />
            </div>
            {nodeParam && (
              <span className="text-xs text-muted-foreground">
                노드: <span className="font-mono">{nodeParam}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-6 px-1"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("node");
                    url.searchParams.delete("sel");
                    router.replace(url.pathname + url.search);
                  }}
                >
                  전체 보기
                </Button>
              </span>
            )}
            <Select
              value={filterParam ?? "__all__"}
              onValueChange={(v) => {
                const url = new URL(window.location.href);
                if (v === "__all__") url.searchParams.delete("filter");
                else url.searchParams.set("filter", v);
                if (nodeParam) url.searchParams.set("node", nodeParam);
                router.replace(url.pathname + url.search);
              }}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">전체</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
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
                    {scanning ? "시작 중…" : "시작"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div>
            {loading ? (
              <HeatmapSkeleton />
            ) : (
              <DeviceHeatmap
                items={displayItems}
                tileSize={tileSize}
                onTileClick={(item) => setSelectedIndex(item.index)}
                selectedIndex={selectedIndex}
              />
            )}
          </div>
          {selectedItem && (
            <Card className="w-72 shrink-0">
              <CardHeader className="pb-2">
                <p className="text-sm font-medium flex items-center justify-between gap-2">
                  <span>#{selectedItem.index}</span>
                  {selectedItem.online ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Wifi className="size-3" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <WifiOff className="size-3" />
                      Offline
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {selectedItem.last_seen && (
                  <p className="text-muted-foreground">last_seen: {new Date(selectedItem.last_seen).toLocaleString("ko-KR")}</p>
                )}
                {selectedItem.last_error_message && (
                  <p className="text-destructive truncate" title={selectedItem.last_error_message}>
                    {selectedItem.last_error_message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<HeatmapSkeleton className="p-8" />}>
      <DevicesPageContent />
    </Suspense>
  );
}
