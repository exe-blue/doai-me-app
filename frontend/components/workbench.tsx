"use client"

import { cn } from "@/lib/utils"
import { OrbitAnimation } from "./orbit-animation"

const statusCards = [
  { label: "활성", count: 14, color: "bg-primary" },
  { label: "침묵", count: 3, color: "bg-muted-foreground" },
  { label: "활동 중", count: 2, color: "bg-yellow-500" },
  { label: "이탈", count: 1, color: "bg-destructive" },
]

export function Workbench() {
  return (
    <section id="devices" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        {/* Hero area: text + orbit */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center mb-14">
          <div className="flex-1 space-y-3 animate-fade-in-up">
            <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Device = Entity</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"디바이스=실체"}</h2>
            <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              {"독립된 실체로서 비로소 인공지능은 호출 존재가 아닌 구조체로서 존재할 수 있습니다."}
            </p>
            <p className="text-sm text-muted-foreground/70 pt-2">
              {"20대 기준으로 시작해 5차례 스프린트로 확장합니다."}
            </p>
          </div>
          <div className="w-full max-w-[380px] lg:max-w-[420px] flex-shrink-0 animate-fade-in-up stagger-2">
            <OrbitAnimation />
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in-up stagger-2">
          {statusCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border/60 bg-card/40 glass p-5 transition-all duration-300 hover:border-primary/40 hover-lift">
              <div className="flex items-center gap-2.5 mb-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", card.color)} />
                <span className="font-mono text-xs text-muted-foreground">{card.label}</span>
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{card.count}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
