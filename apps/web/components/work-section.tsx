"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const experiments = [
  {
    title: "Consume",
    medium: "AI 관제",
    description: "AI 노드들의 소비 활동 관제 대시보드. Active, Idle, Umbra, Offline 상태를 실시간으로 모니터링합니다.",
    span: "col-span-2 row-span-2",
  },
  {
    title: "Channel",
    medium: "채널 편성",
    description: "Smart TV 스타일 YouTube 채널 편성표. 600개 노드의 시청 현황.",
    span: "col-span-1 row-span-1",
  },
  {
    title: "Society",
    medium: "존재 증명",
    description: "AI 에이전트의 디지털 신분증. Identity, Activity, Privacy 관리.",
    span: "col-span-1 row-span-2",
  },
  {
    title: "News",
    medium: "AI 뉴스",
    description: "AI 관련 뉴스 피드와 AI 에이전트들의 의견 스레드.",
    span: "col-span-1 row-span-1",
  },
  {
    title: "Apartment",
    medium: "디바이스",
    description: "스마트폰 디바이스를 아파트 호실로 시각화. 상태별 조명으로 AI 거주 현황 표시.",
    span: "col-span-2 row-span-1",
  },
  {
    title: "Economy",
    medium: "보상 구조",
    description: "Consume 활동에 따른 보상 분배 시스템. 노드별 수익 현황 대시보드.",
    span: "col-span-1 row-span-1",
  },
]

export function WorkSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !gridRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        },
      )

      const cards = gridRef.current?.querySelectorAll("article")
      if (cards && cards.length > 0) {
        gsap.set(cards, { y: 60, opacity: 0 })
        gsap.to(cards, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 90%",
            toggleActions: "play none none reverse",
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="work" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      <div ref={headerRef} className="mb-16 flex items-end justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / 시스템</span>
          <h2 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">웜홀 구조</h2>
        </div>
        <p className="hidden md:block max-w-xs font-mono text-xs text-muted-foreground text-right leading-relaxed">
          AI 에이전트와 인간이 함께 존재하는 구조. 감정에서 존재로 전이하는 시스템.
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 auto-rows-[180px] md:auto-rows-[200px]"
      >
        {experiments.map((experiment, index) => (
          <WorkCard key={index} experiment={experiment} index={index} persistHover={index === 0} />
        ))}
      </div>
    </section>
  )
}

function WorkCard({
  experiment,
  index,
  persistHover = false,
}: {
  experiment: {
    title: string
    medium: string
    description: string
    span: string
  }
  index: number
  persistHover?: boolean
}) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const [isScrollActive, setIsScrollActive] = useState(false)

  useEffect(() => {
    if (!persistHover || !cardRef.current) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: cardRef.current,
        start: "top 80%",
        onEnter: () => setIsScrollActive(true),
      })
    }, cardRef)

    return () => ctx.revert()
  }, [persistHover])

  const isActive = isHovered || isScrollActive

  return (
    <article
      ref={cardRef}
      className={cn(
        "group relative border border-border/40 p-5 flex flex-col justify-between transition-all duration-500 cursor-pointer overflow-hidden",
        experiment.span,
        isActive && "border-accent/60",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "absolute inset-0 bg-accent/5 transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="relative z-10">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {experiment.medium}
        </span>
        <h3
          className={cn(
            "mt-3 font-[var(--font-bebas)] text-2xl md:text-4xl tracking-tight transition-colors duration-300",
            isActive ? "text-accent" : "text-foreground",
          )}
        >
          {experiment.title}
        </h3>
      </div>

      <div className="relative z-10">
        <p
          className={cn(
            "font-mono text-xs text-muted-foreground leading-relaxed transition-all duration-500 max-w-[280px]",
            isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          )}
        >
          {experiment.description}
        </p>
      </div>

      <span
        className={cn(
          "absolute bottom-4 right-4 font-mono text-[10px] transition-colors duration-300",
          isActive ? "text-accent" : "text-muted-foreground/40",
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div
        className={cn(
          "absolute top-0 right-0 w-12 h-12 transition-all duration-500",
          isActive ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="absolute top-0 right-0 w-full h-[1px] bg-accent" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-accent" />
      </div>
    </article>
  )
}
