"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePolling } from "@/lib/api";
import { LOADER_DELAY_MS, POLL_INTERVAL_RUN_MONITOR_MS } from "@/lib/constants";
import { toRunMonitorVM } from "@/lib/viewmodels/runMonitorVM";
import type { RunMonitorVM } from "@/lib/viewmodels/runMonitorVM";
import { DeviceHeatmap } from "@/components/DeviceHeatmap";
import { HeatmapSkeleton } from "@/components/Skeleton";
import { Loader } from "@/components/Loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Square } from "lucide-react";
import { toast } from "sonner";

const statusLabel: Record<string, string> = {
  queued: "대기열",
  running: "실행 중",
  completed: "완료",
  completed_with_errors: "완료(일부 오류)",
  failed: "실패",
  stopped: "중단됨",
};

export default function RunMonitorPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [showDelayedLoader, setShowDelayedLoader] = useState(false);

  const pollUrl =
    runId && selectedIndex != null
      ? `/api/runs/${runId}?selected=${selectedIndex}`
      : runId
        ? `/api/runs/${runId}`
        : "";
  const { data: raw, loading, error, refetch } = usePolling<unknown>(pollUrl, POLL_INTERVAL_RUN_MONITOR_MS, {
    enabled: !!runId,
  });

  useEffect(() => {
    if (!loading) {
      setShowDelayedLoader(false);
      return;
    }
    const t = setTimeout(() => setShowDelayedLoader(true), LOADER_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading]);

  const vm: RunMonitorVM | null = toRunMonitorVM(raw as Parameters<typeof toRunMonitorVM>[0]);
  const run = vm?.run;
  const heatmapItems = vm?.heatmapItems ?? [];
  const selected = vm?.selected ?? null;
  const highlightIndex = selectedIndex ?? selected?.index ?? null;
  const tileSize = 36;
  const selectedItem = selected ? heatmapItems.find((i) => i.index === selected.index) : null;
  const isWaiting = selectedItem?.activity === "waiting";
  const lastScreenshot = selected?.last_artifacts?.find((a) => a.kind === "screenshot" && a.url);

  const handleStop = async () => {
    setStopLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/stop`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("실행 중단 요청을 보냈습니다.");
        refetch();
      } else {
        toast.error(body.error ?? "중단 요청 실패");
      }
    } finally {
      setStopLoading(false);
    }
  };

  if (!runId) {
    return <div className="p-6 text-destructive">runId 없음</div>;
  }

  if (error && !vm) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/runs">실행 목록</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/runs">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight font-mono">{run?.title ?? run?.run_id ?? runId}</h1>
          <p className="text-sm text-muted-foreground">
            시작: {run?.started_at ? new Date(run.started_at).toLocaleString("ko-KR") : "—"}
          </p>
        </div>
        {(run?.status === "queued" || run?.status === "running") && (
          <Button variant="destructive" size="sm" onClick={handleStop} disabled={stopLoading}>
            <Square className="size-4 mr-2" />
            {stopLoading ? "요청 중…" : "실행 중단"}
          </Button>
        )}
      </div>

      <div className="flex gap-6 flex-wrap">
        <Card className="flex-1 min-w-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{run ? statusLabel[run.status] ?? run.status : "—"}</Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
                새로고침
              </Button>
            </div>
            {(() => {
              if (loading && heatmapItems.length === 0) {
                return showDelayedLoader ? (
                  <div className="flex items-center justify-center min-h-[200px]">
                    <Loader show />
                  </div>
                ) : (
                  <HeatmapSkeleton />
                );
              }
              return (
              <DeviceHeatmap
                items={heatmapItems}
                tileSize={tileSize}
                onTileClick={(item) => setSelectedIndex(item.index)}
                selectedIndex={highlightIndex}
                className="mx-auto"
              />
              );
            })()}
          </CardContent>
        </Card>

        <Card className="w-96 shrink-0 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
          <CardContent className="pt-6 flex flex-col min-h-0 overflow-hidden">
            {selected ? (
              <>
                <h3 className="font-semibold text-sm">디바이스 #{selected.index}</h3>
                {isWaiting && (
                  <Badge variant="outline" className="mt-1 text-amber-600 border-amber-500">
                    WAIT 15s…
                  </Badge>
                )}
                {selected.current_step && (
                  <p className="text-xs text-muted-foreground mt-1">
                    스텝: {selected.current_step.step_id} ({selected.current_step.status})
                  </p>
                )}
                {lastScreenshot?.url && (
                  <div className="mt-3 rounded border overflow-hidden bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">마지막 스크린샷</p>
                    <img
                      src={lastScreenshot.url}
                      alt="Screenshot"
                      className="w-full h-auto max-h-40 object-contain"
                    />
                  </div>
                )}
                {selected.logs_tail && selected.logs_tail.length > 0 && (
                  <div className="mt-3 flex-1 min-h-0 flex flex-col">
                    <p className="text-xs font-medium text-muted-foreground mb-1">최근 로그 (최대 50줄)</p>
                    <div className="rounded bg-muted/50 p-2 flex-1 min-h-0 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5">
                      {selected.logs_tail.map((line, i) => (
                        <div key={`log-${selected.index}-${i}-${line.slice(0, 30)}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
                {selected.last_artifacts && selected.last_artifacts.length > 0 && !lastScreenshot?.url && (
                  <p className="text-xs text-muted-foreground mt-2">스크린샷: {selected.last_artifacts.length}개 (URL 없음)</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">타일을 클릭하면 디바이스 실행 과정을 볼 수 있습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" asChild>
        <Link href="/runs">실행 목록으로</Link>
      </Button>
    </div>
  );
}
