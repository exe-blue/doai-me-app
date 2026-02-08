"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const filters = [
  { key: "videoId", label: "videoId", placeholder: "V-xxxx" },
  { key: "deviceId", label: "deviceId", placeholder: "D-xxx" },
  { key: "timeRange", label: "시간 범위", placeholder: "최근 24시간" },
]

const artifacts = [
  {
    id: "A-0112",
    deviceId: "D-001",
    runId: "R-0041",
    videoId: "V-1032",
    uploaded: "2026-02-08 14:35",
    meta: "Host Alpha / NET-A01",
    link: "#",
  },
  {
    id: "A-0111",
    deviceId: "D-003",
    runId: "R-0041",
    videoId: "V-1032",
    uploaded: "2026-02-08 14:34",
    meta: "Host Gamma / NET-A03",
    link: "#",
  },
  {
    id: "A-0110",
    deviceId: "D-005",
    runId: "R-0040",
    videoId: "V-1031",
    uploaded: "2026-02-08 12:20",
    meta: "Host Epsilon / NET-B02",
    link: "#",
  },
  {
    id: "A-0109",
    deviceId: "D-002",
    runId: "R-0040",
    videoId: "V-1031",
    uploaded: "2026-02-08 12:18",
    meta: "Host Beta / NET-A02",
    link: "#",
  },
]

export function ArtifactsSection() {
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null)

  return (
    <section id="artifacts" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 sm:mb-14 space-y-3 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Logs</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"로그"}</h2>
          <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            {"기기별로 저장 후, 중앙 저장소 업로드."}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8 animate-fade-in-up stagger-2">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-4 py-2.5">
              <span className="font-mono text-xs text-muted-foreground">{filter.label}:</span>
              <span className="font-mono text-xs text-muted-foreground/50">{filter.placeholder}</span>
            </div>
          ))}
        </div>

        {/* Artifacts grid */}
        <div className="grid gap-4 sm:grid-cols-2 animate-fade-in-up stagger-3">
          {artifacts.map((artifact, index) => (
            <button
              type="button"
              key={artifact.id}
              className={cn(
                "group rounded-xl border border-border/60 bg-card/40 glass p-5 sm:p-6 text-left transition-all duration-400 hover:border-primary/40 hover:bg-card/60 hover-lift cursor-pointer",
                selectedArtifact === artifact.id && "border-primary/50 bg-card/70",
              )}
              style={{ animationDelay: `${index * 100 + 200}ms` }}
              onClick={() => setSelectedArtifact(selectedArtifact === artifact.id ? null : artifact.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm font-medium text-foreground">{artifact.id}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{artifact.uploaded}</span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{"기기별 저장 정보"}:</span>
                  <span className="font-mono text-xs text-foreground/80">{artifact.meta}</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{"실행 ID"}:</span>
                  <span className="font-mono text-xs text-primary">{artifact.runId}</span>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{"원본 링크(중앙 저장소)"}:</span>
                  <span className="font-mono text-xs text-primary hover:underline">{artifact.videoId}</span>
                </div>
              </div>

              {selectedArtifact === artifact.id && (
                <div className="mt-4 pt-4 border-t border-border/50 font-mono text-xs text-muted-foreground/60 animate-fade-in">
                  {"업로드 시각"}: {artifact.uploaded}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
