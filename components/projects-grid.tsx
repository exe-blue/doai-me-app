"use client"

import { cn } from "@/lib/utils"

const worldviewBullets = [
  {
    title: "기기마다 개별 AI 호스트",
    description: "각 물리 기기에는 하나의 독립적인 AI 호스트가 할당됩니다.",
  },
  {
    title: "콘텐츠를 스스로 탐험",
    description: "호스트는 지시가 아닌, 자율적 관측을 통해 콘텐츠를 소비합니다.",
  },
  {
    title: "기록은 축적되고, 세계는 확장",
    description: "모든 관측과 행동은 기록되며, 시간이 지남에 따라 세계가 확장됩니다.",
  },
]

const mvpItems = [
  "Supabase 기반 등록/이벤트",
  "YouTube 신규 업로드 감지 -> DB 등록",
  "접근성 입력 테스트 (ID/PW/버튼)",
  "ALL 기기 스크린샷 수집 -> 중앙 저장소 업로드",
  "20대 기준, 5 스프린트 확장",
]

export function ProjectsGrid() {
  return (
    <section id="overview" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 sm:mb-14 space-y-3 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Overview</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"오버뷰"}</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-10 sm:mb-14">
          {worldviewBullets.map((bullet, index) => (
            <div
              key={bullet.title}
              className={cn(
                "group rounded-xl border border-border/60 bg-card/40 glass p-6 sm:p-7 transition-all duration-400 hover:border-primary/40 hover:bg-card/60 hover-lift animate-fade-in-up",
              )}
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <div className="mb-3 font-mono text-xs text-primary">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3 className="mb-3 text-lg font-semibold tracking-tight">{bullet.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{bullet.description}</p>
            </div>
          ))}
        </div>

        {/* MVP Callout */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8 animate-fade-in-up stagger-4">
          <h3 className="mb-5 text-lg font-semibold tracking-tight">
            {"이번 MVP에서 확정하는 것"}
          </h3>
          <ul className="space-y-3">
            {mvpItems.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-3 text-sm text-muted-foreground"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
