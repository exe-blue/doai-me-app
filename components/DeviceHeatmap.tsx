"use client";

import { cn } from "@/lib/utils";
import { tokens } from "@/lib/tokens";
import type { HeatmapItem } from "@/lib/heatmap";
import { HEATMAP_COLS, HEATMAP_TILE_SIZE, HEATMAP_MINI_TILE_SIZE } from "@/lib/heatmap";

const COLS = HEATMAP_COLS;
const ROWS = HEATMAP_COLS;
const TOTAL = COLS * ROWS;

function getBorderColor(activity?: string): string {
  switch (activity) {
    case "running": return "var(--blue-6)";
    case "waiting": return "var(--amber-6)";
    case "error": return "var(--red-7)";
    case "done": return "var(--gray-6)";
    default: return "var(--gray-5)";
  }
}

export interface DeviceHeatmapProps {
  /** HeatmapItem[] (index, online, activity?, progress?, …) */
  items: HeatmapItem[];
  cols?: number;
  tileSize?: number;
  /** true = 미니맵용 작은 타일 */
  mini?: boolean;
  onTileClick?: (item: HeatmapItem) => void;
  selectedIndex?: number | null;
  className?: string;
}

export function DeviceHeatmap({
  items,
  cols = COLS,
  tileSize: tileSizeProp,
  mini = false,
  onTileClick,
  selectedIndex = null,
  className,
}: DeviceHeatmapProps) {
  const tileSize = tileSizeProp ?? (mini ? HEATMAP_MINI_TILE_SIZE : HEATMAP_TILE_SIZE);
  const byIndex = new Map(items.map((i) => [i.index, i]));
  const cells = Array.from({ length: TOTAL }, (_, i) => {
    const idx = i + 1;
    const existing = byIndex.get(idx);
    return existing ?? { index: idx, online: false, activity: "idle" as const, empty: true };
  });

  return (
    <div
      className={cn("inline-grid gap-0.5", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
        gridTemplateRows: `repeat(${Math.ceil(TOTAL / cols)}, ${tileSize}px)`,
      }}
    >
      {cells.map((item) => {
        const isSelected = selectedIndex !== null && selectedIndex !== undefined && item.index === selectedIndex;
        const isEmpty = "empty" in item && item.empty;
        const bg = isEmpty
          ? tokens.device.offlineBgDim
          : item.online
            ? tokens.device.onlineBg
            : tokens.device.offlineBg;
        const borderColor = getBorderColor(item.activity ?? "idle");
        return (
          <button
            key={item.index}
            type="button"
            className={cn(
              "flex flex-col items-center justify-center rounded text-xs font-bold transition-colors border-2",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
              onTileClick ? "cursor-pointer hover:opacity-90" : "cursor-default",
              isSelected && "ring-2 ring-primary ring-offset-1"
            )}
            style={{
              minWidth: tileSize,
              minHeight: tileSize,
              background: bg,
              borderColor,
            }}
            onClick={() => onTileClick?.(item)}
          >
            <span className="leading-none" style={{ color: tokens.text.primary }}>
              {item.index}
            </span>
            {item.progress && !mini && (
              <span className="text-[10px] font-normal opacity-80" style={{ color: tokens.text.muted }}>
                {item.progress.current}/{item.progress.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
