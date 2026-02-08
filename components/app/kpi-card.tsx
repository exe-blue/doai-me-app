"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type KpiStatus = "online" | "offline" | "running" | "error" | "done" | "neutral"

const statusDotClass: Record<KpiStatus, string> = {
  online: "bg-[var(--status-online)]",
  offline: "bg-[var(--status-offline)]",
  running: "bg-[var(--status-running)]",
  error: "bg-[var(--status-error)]",
  done: "bg-[var(--status-done)]",
  neutral: "bg-muted-foreground/40",
}

interface KpiCardProps {
  label: string
  value: string | number
  href?: string
  status?: KpiStatus
  className?: string
}

/**
 * 대시보드 KPI 카드. 클릭 시 href로 드릴다운.
 * 새 컴포넌트 만들기 전에 이 컴포넌트로 해결 시도 (MVP 규칙).
 */
export function KpiCard({ label, value, href, status = "neutral", className }: KpiCardProps) {
  const dot = <span className={cn("inline-block size-2 rounded-full shrink-0", statusDotClass[status])} aria-hidden />

  const content = (
    <>
      <div className="flex items-center gap-2">
        {dot}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={cn("py-3 hover:bg-muted/50 transition-colors cursor-pointer", className)}>
          <CardContent className="px-4">{content}</CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Card className={cn("py-3", className)}>
      <CardContent className="px-4">{content}</CardContent>
    </Card>
  )
}
