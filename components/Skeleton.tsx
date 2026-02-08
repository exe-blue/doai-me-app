"use client";

import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";
import { HEATMAP_COLS, HEATMAP_TILE_SIZE } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

const TOTAL = HEATMAP_COLS * HEATMAP_COLS;

export function HeatmapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("inline-grid gap-0.5", className)}
      style={{
        gridTemplateColumns: `repeat(${HEATMAP_COLS}, ${HEATMAP_TILE_SIZE}px)`,
        gridTemplateRows: `repeat(${HEATMAP_COLS}, ${HEATMAP_TILE_SIZE}px)`,
      }}
    >
      {Array.from({ length: TOTAL }, (_, i) => i).map((i) => (
        <UiSkeleton key={`heatmap-${i}`} style={{ width: HEATMAP_TILE_SIZE, height: HEATMAP_TILE_SIZE }} className="rounded" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 border-b pb-2">
        {Array.from({ length: cols }, (_, i) => i).map((i) => (
          <UiSkeleton key={`col-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => i).map((i) => (
        <div key={`row-${i}`} className="flex gap-2">
          {Array.from({ length: cols }, (_, j) => j).map((j) => (
            <UiSkeleton key={`row-${i}-col-${j}`} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { UiSkeleton as Skeleton };
