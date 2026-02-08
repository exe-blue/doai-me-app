"use client"

import { cn } from "@/lib/utils"

export type DeviceTileStatus = "running" | "error" | "done" | "wait" | null

export interface DeviceTileData {
  id: string
  device_id: string
  index: number
  online: boolean
  runStatus?: DeviceTileStatus
  progress?: string
  waitLabel?: string
}

interface DeviceHeatmapProps {
  devices: (DeviceTileData | null)[]
  tileSize?: number
  onTileClick?: (device: DeviceTileData | null) => void
  selectedId?: string | null
  showProgress?: boolean
  className?: string
}

const COLS = 10
const ROWS = 10
const TOTAL = COLS * ROWS

export function DeviceHeatmap({
  devices,
  tileSize = 36,
  onTileClick,
  selectedId,
  showProgress = false,
  className,
}: DeviceHeatmapProps) {
  const cells = Array.from({ length: TOTAL }, (_, i) => devices[i] ?? null)

  return (
    <div
      className={cn("inline-grid gap-0.5", className)}
      style={{
        gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${tileSize}px)`,
      }}
    >
      {cells.map((cell, i) => {
        const isSelected = cell && selectedId === cell.id
        const online = cell?.online ?? false
        const runStatus = cell?.runStatus ?? null
        return (
          <button
            key={cell?.id ?? `empty-${i}`}
            type="button"
            className={cn(
              "flex flex-col items-center justify-center rounded border-2 text-xs font-bold transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
              cell ? "cursor-pointer hover:opacity-90" : "cursor-default",
              online
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
              runStatus === "running" && "border-blue-500 ring-1 ring-blue-500/50",
              runStatus === "error" && "border-red-500 border-2",
              runStatus === "done" && "border-border",
              runStatus === "wait" && "border-amber-500 border-2",
              !cell && "bg-muted/30 border-muted text-muted-foreground",
              isSelected && "ring-2 ring-primary ring-offset-1"
            )}
            style={{ minWidth: tileSize, minHeight: tileSize }}
            onClick={() => onTileClick?.(cell)}
          >
            {cell ? (
              <>
                <span className="leading-none">{cell.index}</span>
                {showProgress && cell.progress && (
                  <span className="text-[10px] font-normal opacity-80">{cell.progress}</span>
                )}
                {cell.waitLabel && (
                  <span className="text-[9px] font-normal text-amber-600 dark:text-amber-400">
                    {cell.waitLabel}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
