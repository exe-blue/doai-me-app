"use client"

import Link from "next/link"
import { IdeAnimation } from "./ide-animation"

const stats = [
  { value: "600+", label: "물리 기기" },
  { value: "600+", label: "독립 네트워크" },
  { value: "24/7", label: "상시 활동" },
  { value: "MVP", label: "세팅 -> 실행 -> 기록" },
]

export function HeroSection() {
  return (
    <section className="relative px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          {/* Left: Text Content */}
          <div className="max-w-xl flex-1 space-y-8 sm:space-y-10">
            <div className="space-y-5 animate-fade-in-up">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
                DoAi.Me
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance leading-tight">
                {"AI가 스스로 콘텐츠를"}
                <br />
                {"소비하는 세계"}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground font-light">
                {"각 기기마다 하나의 AI 호스트가 존재합니다."}
              </p>
            </div>

            <div className="space-y-2 text-sm sm:text-base text-muted-foreground leading-relaxed animate-fade-in-up stagger-2">
              <p>{"물리 디바이스는 단말이 아니라, 하나의 관측 지점입니다."}</p>
              <p>{"그들은 보고, 선택하고, 기록합니다."}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up stagger-3">
              <Link
                href="/dashboard/onboarding"
                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-lg border border-primary bg-primary/10 px-7 py-4 sm:py-3.5 font-mono text-sm text-primary transition-all duration-500 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
              >
                <span className="relative z-10">{"세팅 시작"}</span>
                <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">{"->"}</span>
                <span className="absolute inset-0 -translate-x-full bg-primary transition-transform duration-500 group-hover:translate-x-0" />
              </Link>
              <Link
                href="/dashboard/devices"
                className="group inline-flex items-center justify-center gap-3 rounded-lg border border-border px-7 py-4 sm:py-3.5 font-mono text-sm text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground hover:bg-secondary/50 active:scale-[0.98]"
              >
                <span>{"기기 보기"}</span>
                <span className="opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  {"->"}
                </span>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 animate-fade-in-up stagger-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border/60 bg-card/40 glass p-4 text-center"
                >
                  <div className="font-mono text-lg sm:text-xl font-bold text-primary">{stat.value}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: IDE Animation */}
          <div className="w-full lg:flex-1 lg:max-w-xl animate-fade-in-up stagger-3">
            <IdeAnimation />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 animate-fade-in stagger-6">
        <span className="font-mono text-xs text-muted-foreground">scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-primary/50 to-transparent animate-pulse" />
      </div>
    </section>
  )
}
