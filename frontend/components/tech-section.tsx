import { cn } from "@/lib/utils"

const techCards = [
  {
    title: "Supabase",
    subtitle: "등록과 이벤트",
    description: "기기 등록, 콘텐츠 메타데이터, 실행 이벤트 로깅을 위한 중앙 데이터베이스.",
  },
  {
    title: "Node Agent",
    subtitle: "로컬 제어 프록시",
    description: "각 기기에서 동작하는 에이전트. 중앙 명령을 수신하고 접근성 입력을 수행합니다.",
  },
  {
    title: "WebSocket 제어",
    subtitle: "입력/앱/스크린샷",
    description: "실시간 양방향 통신으로 입력 전달, 앱 제어, 스크린샷 캡처를 수행합니다.",
  },
]

export function TechSection() {
  return (
    <section id="tech" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 sm:mb-14 space-y-3 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Technical Implementation</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"기술적 구현"}</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3 mb-8 animate-fade-in-up stagger-2">
          {techCards.map((card, index) => (
            <div
              key={card.title}
              className={cn(
                "group rounded-xl border border-border/60 bg-card/40 glass p-6 sm:p-7 transition-all duration-400 hover:border-primary/40 hover:bg-card/60 hover-lift",
              )}
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <div className="mb-1 font-mono text-xs text-primary">{card.title}</div>
              <h3 className="mb-3 text-base font-semibold tracking-tight">{card.subtitle}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Code callout */}
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-5 font-mono text-sm text-muted-foreground animate-fade-in-up stagger-3">
          <span className="text-primary">{"$"}</span>{" "}
          <span className="text-foreground/80">{"devices=all"}</span>
          <span className="text-muted-foreground">{" -> "}</span>
          <span className="text-foreground/80">{"screen"}</span>
          <span className="text-muted-foreground">{" -> "}</span>
          <span className="text-foreground/80">{"upload"}</span>
        </div>
      </div>
    </section>
  )
}
