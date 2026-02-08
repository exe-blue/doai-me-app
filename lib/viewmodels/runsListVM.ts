/**
 * 실행 목록 ViewModel — R1. Table row 최소 필드 고정.
 */
export interface RunsListVMRow {
  run_id: string;
  title: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  counts: {
    running: number;
    done: number;
    error: number;
    waiting: number;
    skipped_offline: number;
  };
}

export type RunsListVM = RunsListVMRow[];

type RunsListRaw = {
  items?: {
    run_id: string;
    title?: string | null;
    status: string;
    created_at?: string | null;
    started_at?: string | null;
    counts?: RunsListVMRow["counts"];
  }[];
};

export function toRunsListVM(raw: RunsListRaw | null): RunsListVM {
  if (!raw?.items) return [];
  return raw.items.map((r) => ({
    run_id: r.run_id,
    title: r.title ?? r.run_id.slice(0, 8),
    status: r.status,
    created_at: r.created_at ?? null,
    started_at: r.started_at ?? null,
    counts: r.counts ?? { running: 0, done: 0, error: 0, waiting: 0, skipped_offline: 0 },
  }));
}
