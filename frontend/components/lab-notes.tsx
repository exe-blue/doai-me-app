"use client"

import { cn } from "@/lib/utils"

const steps = [
  {
    id: 1,
    label: "관측",
    title: "업로드 감지",
    description: "YouTube 채널에서 신규 업로드가 감지되면 파이프라인이 시작됩니다.",
  },
  {
    id: 2,
    label: "등록",
    title: "DB 기록",
    description: "감지된 콘텐츠 메타데이터가 Supabase에 등록됩니다.",
  },
  {
    id: 3,
    label: "배포",
    title: "전체 기기 호출(ALL)",
    description: "등록된 콘텐츠에 대해 전체 기기에 관측 명령이 전파됩니다.",
  },
  {
    id: 4,
    label: "행동",
    title: "접근성 입력(ID/PW/버튼)",
    description: "각 기기의 호스트가 접근성 API를 통해 로그인 및 탐색을 수행합니다.",
  },
  {
    id: 5,
    label: "기록",
    title: "스크린샷 저장 + 업로드",
    description: "행동의 결과가 스크린샷으로 캡처되어 중앙 저장소에 업로드됩니다.",
  },
]

export function LabNotes() {
  return (
    <section id="runs" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 sm:mb-14 space-y-3 animate-fade-in-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">Execution</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{"실행"}</h2>
          <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            {"의식 실행 흐름: 관측에서 기록까지"}
          </p>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50 hidden sm:block" />

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "group relative flex gap-5 sm:gap-8 animate-fade-in-up",
                )}
                style={{ animationDelay: `${index * 100 + 200}ms` }}
              >
                {/* Step circle */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-xs text-primary transition-all duration-300 group-hover:border-primary group-hover:bg-primary/10">
                  {step.id}
                </div>

                {/* Content */}
                <div className="flex-1 rounded-xl border border-border/60 bg-card/40 glass p-5 sm:p-6 transition-all duration-400 group-hover:border-primary/40 group-hover:bg-card/60 hover-lift">
                  <div className="mb-1 font-mono text-xs text-primary">{step.label}</div>
                  <h3 className="mb-2 text-base sm:text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
