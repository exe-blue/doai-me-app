"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DeviceHeatmap } from "@/components/DeviceHeatmap";
import type { MiniHeatmapNode } from "@/lib/viewmodels/dashboardVM";
import { HEATMAP_MINI_TILE_SIZE } from "@/lib/heatmap";

export interface MiniMapProps {
  readonly nodes: readonly MiniHeatmapNode[];
  readonly className?: string;
}

/** 노드 스트립 + 포커스된 노드 10×10 그리드. 타일 클릭 시 /devices?node=...&sel=... */
export function MiniMap({ nodes, className }: MiniMapProps) {
  const router = useRouter();
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const activeNodeId = focusNodeId ?? hoverNodeId ?? nodes[0]?.node_id ?? null;
  const activeNode = nodes.find((n) => n.node_id === activeNodeId);

  const handleTileClick = useCallback(
    (node_id: string, index: number) => {
      router.push(`/devices?node=${encodeURIComponent(node_id)}&sel=${index}`);
    },
    [router]
  );

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-slot="minimap-empty">
        등록된 노드 없음
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="minimap">
      {/* Node strip: hover = preview, click = lock focus */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="노드 선택">
        {nodes.map((n) => {
          const isActive = activeNodeId === n.node_id;
          const isHover = hoverNodeId === n.node_id;
          return (
            <button
              key={n.node_id}
              type="button"
              role="tab"
              aria-selected={isActive ? "true" : "false"}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                isHover && !isActive && "border-muted-foreground/30"
              )}
              onMouseEnter={() => setHoverNodeId(n.node_id)}
              onMouseLeave={() => setHoverNodeId(null)}
              onClick={() => setFocusNodeId((prev) => (prev === n.node_id ? null : n.node_id))}
            >
              <span className="font-mono">{n.label}</span>
              <span className="text-emerald-600 dark:text-emerald-400">{n.counts.online}</span>
              <span className="text-red-600 dark:text-red-400">/ {n.counts.offline}</span>
            </button>
          );
        })}
      </div>

      {/* Grid: 항상 100칸(VM에서 normalizeToSlots 적용됨) */}
      {activeNode && (
        <DeviceHeatmap
          items={activeNode.items}
          mini
          tileSize={HEATMAP_MINI_TILE_SIZE}
          onTileClick={(item) => handleTileClick(activeNode.node_id, item.index)}
          className="mx-auto"
        />
      )}
    </div>
  );
}
