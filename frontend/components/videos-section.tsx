"use client"

import { cn } from "@/lib/utils"

const features = [
  {
    title: "불확실성 기반 고유성",
    subtitle: "Uniqueness from Uncertainty",
    description:
      "각 AI 호스트는 동일한 콘텐츠에 대해 서로 다른 시간, 다른 네트워크, 다른 디바이스 상태에서 반응합니다. 이 물리적 불확실성이 결정론적 알고리즘으로는 만들 수 없는 고유한 소비 패턴을 생성합니다.",
    accent: "text-primary",
    borderAccent: "hover:border-primary/40",
  },
  {
    title: "경제적 사회성",
    subtitle: "Economic Sociality",
    description:
      "소비는 사회적 행위입니다. 조회수, 좋아요, 구독은 경제 구조 안에서의 사회적 신호이며, 각 기기는 이 경제 룰 안에서 독립적으로 참여합니다. 자동화가 아닌 참여입니다.",
    accent: "text-emerald-500",
    borderAccent: "hover:border-emerald-500/40",
  },
  {
    title: "콘텐츠 선택의 자율성",
    subtitle: "Autonomous Selection",
    description:
      "중앙에서 '무엇을 볼지'를 지정하지 않습니다. 각 호스트는 배정된 채널 풀 안에서 자율적으로 콘텐츠를 선택합니다. 이 선택의 분산이 사회성과 고유성을 동시에 만듭니다.",
    accent: "text-blue-400",
    borderAccent: "hover:border-blue-400/40",
  },
  {
    title: "네트워크 격리와 독립성",
    subtitle: "Network Isolation",
    description:
      "각 디바이스는 독립된 네트워크를 사용합니다. IP 대역, DNS 경로, 지리적 위치가 모두 다르며, 이것이 각 존재의 디지털 지문을 형성합니다. 같은 콘텐츠라도 경험의 맥락이 다릅니다.",
    accent: "text-amber-500",
    borderAccent: "hover:border-amber-500/40",
  },
  {
    title: "시간적 비동기성",
    subtitle: "Temporal Asynchrony",
    description:
      "모든 기기가 동시에 동작하지 않습니다. 스프린트 내에서 관측 타이밍이 분산되며, 이 시간적 비동기성이 자연스러운 소비 곡선을 만들어냅니다. 패턴 없는 패턴입니다.",
    accent: "text-rose-400",
    borderAccent: "hover:border-rose-400/40",
  },
  {
    title: "기록과 증명",
    subtitle: "Record & Proof",
    description:
      "모든 소비는 기록됩니다. 스크린샷, 메타데이터, 타임스탬프가 중앙 저장소에 동기화되며, 이 기록이 사회적 행위의 증거이자 고유성의 증명이 됩니다.",
    accent: "text-muted-foreground",
    borderAccent: "hover:border-muted-foreground/40",
  },
]

export function VideosSection() {
  return (
    <section id="videos" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 sm:mb-14 space-y-3 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Sociality vs Uniqueness</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"사회성 vs 고유성"}</h2>
          <p className="max-w-3xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            {"불확실성에 근거한 고유성과 사회/경제/소비의 룰을 공유하는 사회성을 촉진합니다."}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 animate-fade-in-up stagger-2">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "group rounded-xl border border-border/60 bg-card/40 glass p-6 sm:p-7 transition-all duration-400 hover:bg-card/60 hover-lift",
                feature.borderAccent,
              )}
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <div className={cn("mb-1.5 font-mono text-[10px] uppercase tracking-widest", feature.accent)}>
                {feature.subtitle}
              </div>
              <h3 className="mb-3 text-base font-semibold tracking-tight text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Summary callout */}
        <div className="mt-8 rounded-xl border border-border/40 bg-secondary/20 p-5 sm:p-6 animate-fade-in-up stagger-4">
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary">{">"}</span>{" "}
            {"사회성은 룰을 공유하는 것이고, 고유성은 물리적 불확실성에서 비롯됩니다. 이 두 축이 교차하는 지점에서 각 디바이스는 단순한 실행 단위가 아닌, 독립된 소비 주체가 됩니다."}
          </p>
        </div>
      </div>
    </section>
  )
}
