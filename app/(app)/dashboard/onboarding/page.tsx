"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Circle, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  title: string
  description: string
  done: boolean
}

const steps: Step[] = [
  { title: "Supabase 연결", description: "환경 변수(SUPABASE_URL, SUPABASE_ANON_KEY)를 설정합니다.", done: true },
  { title: "YouTube 관측 설정", description: "관측할 채널 또는 플레이리스트 ID를 등록합니다.", done: true },
  { title: "Node Agent 등록", description: "노드 키를 생성하고 에이전트에 배포합니다.", done: false },
  { title: "기기 인식 확인", description: "20대 baseline으로 기기가 정상 인식되는지 확인합니다.", done: false },
  { title: "접근성 입력 테스트", description: "ID/PW/버튼 입력 방식을 안내하고 접근성 입력을 테스트합니다.", done: false },
]

export default function OnboardingPage() {
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">세팅</h1>
        <p className="text-sm text-muted-foreground mt-1">MVP 토대 구축.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{doneCount}/{steps.length}</span>
      </div>

      {/* 오늘의 목표 callout */}
      <Card className="border-primary/20 bg-primary/5 py-4 gap-3">
        <CardHeader className="px-4 py-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <CardTitle className="text-sm text-primary">오늘의 목표</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4">
          <p className="text-xs text-muted-foreground">
            새 영상 감지 → DB 등록 → ALL 스크린샷 수집 → 업로드
          </p>
        </CardContent>
      </Card>

      {/* Checklist */}
      <div className="flex flex-col gap-3">
        {steps.map((step) => (
          <Card key={step.title} className={cn("py-4 gap-3 transition-colors", step.done && "opacity-60")}>
            <CardContent className="px-4 flex items-start gap-4">
              <div className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                step.done
                  ? "bg-emerald-500/20 text-emerald-500"
                  : "bg-secondary text-muted-foreground"
              )}>
                {step.done ? <Check className="size-4" /> : <Circle className="size-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn("text-sm font-medium", step.done && "line-through text-muted-foreground")}>
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              </div>
              <Button
                size="sm"
                variant={step.done ? "ghost" : "secondary"}
                className="h-7 text-xs shrink-0"
                disabled={step.done}
              >
                {step.done ? "완료" : "설정"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
