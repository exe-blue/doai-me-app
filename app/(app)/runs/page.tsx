"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { usePolling } from "@/lib/api";
import { POLL_INTERVAL_RUNS_LIST_MS } from "@/lib/constants";
import { toRunsListVM, type RunsListVMRow } from "@/lib/viewmodels/runsListVM";
import { DataTable } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusLabel: Record<string, string> = {
  queued: "대기열",
  running: "실행 중",
  completed: "완료",
  completed_with_errors: "완료(일부 오류)",
  failed: "실패",
  stopped: "중단됨",
};

export default function RunsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const window = searchParams.get("window") ?? "24h";
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (window) query.set("window", window);
  const url = `/api/runs?${query.toString()}`;

  const { data: raw, loading } = usePolling<unknown>(url, POLL_INTERVAL_RUNS_LIST_MS, { enabled: true });
  const rows = toRunsListVM(raw as Parameters<typeof toRunsListVM>[0]);

  const columns = [
    { key: "title", header: "제목", render: (r: RunsListVMRow) => r.title },
    { key: "status", header: "상태", render: (r: RunsListVMRow) => <Badge variant="secondary">{statusLabel[r.status] ?? r.status}</Badge> },
    { key: "created_at", header: "생성", render: (r: RunsListVMRow) => (r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : "—") },
    { key: "counts", header: "진행", render: (r: RunsListVMRow) => `실행 ${r.counts.running} / 완료 ${r.counts.done} / 오류 ${r.counts.error}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">실행</h1>
          <p className="text-sm text-muted-foreground mt-1">실행 목록 · 행 클릭 시 상세 모니터</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="p-6">
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : (
            <DataTable<RunsListVMRow>
              columns={columns}
              data={rows}
              keyFn={(r) => r.run_id}
              loading={loading && rows.length > 0}
              emptyMessage="해당 실행이 없습니다."
              onRowClick={(r) => router.push(`/runs/${r.run_id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
