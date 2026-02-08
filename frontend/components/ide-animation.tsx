"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"

interface TerminalLine {
  type: "command" | "output" | "status" | "divider" | "blank"
  text: string
  color?: string
}

const SCRIPT: TerminalLine[] = [
  { type: "command", text: "DOAI init --fleet 20" },
  { type: "output", text: "fleet.yml loaded  ·  20 devices registered" },
  { type: "blank", text: "" },
  { type: "command", text: "DOAI devices list --status active" },
  { type: "output", text: "DEV-001  kvm-node-a-01   Wi-Fi    active" },
  { type: "output", text: "DEV-002  kvm-node-a-02   LTE      active" },
  { type: "output", text: "DEV-003  pi-rack-b-01    Wi-Fi    active" },
  { type: "output", text: "DEV-004  mac-mini-c-01   Ethernet active" },
  { type: "status", text: "... 16 more devices online", color: "muted" },
  { type: "blank", text: "" },
  { type: "command", text: "DOAI run create --target 20 --trigger auto" },
  { type: "output", text: "RUN-0041 created" },
  { type: "divider", text: "────────────────────────────────────" },
  { type: "status", text: "step 1/5  관측    ████████████  done", color: "green" },
  { type: "status", text: "step 2/5  등록    ████████████  done", color: "green" },
  { type: "status", text: "step 3/5  배포    ██████░░░░░░  running", color: "blue" },
  { type: "status", text: "step 4/5  행동    ░░░░░░░░░░░░  queued", color: "muted" },
  { type: "status", text: "step 5/5  기록    ░░░░░░░░░░░░  queued", color: "muted" },
  { type: "blank", text: "" },
  { type: "command", text: "DOAI artifacts --run RUN-0041 --count" },
  { type: "output", text: "screenshots: 14   logs: 20   metadata: 20" },
  { type: "status", text: "storage: local -> central (syncing)", color: "blue" },
  { type: "blank", text: "" },
  { type: "command", text: "DOAI status" },
  { type: "status", text: "fleet: 20/20 online", color: "green" },
  { type: "status", text: "runs today: 12 completed  ·  1 running", color: "green" },
  { type: "status", text: "artifacts: 847 files  ·  2.3 GB synced", color: "green" },
  { type: "status", text: "ALL lock: enabled (권한자만)", color: "amber" },
]

function getLineClasses(line: TerminalLine): string {
  if (line.type === "command") return "text-primary"
  if (line.type === "divider") return "text-border"
  if (line.type === "blank") return ""
  if (line.color === "green") return "text-emerald-500"
  if (line.color === "blue") return "text-blue-400"
  if (line.color === "amber") return "text-amber-500"
  if (line.color === "muted") return "text-muted-foreground/60"
  return "text-muted-foreground"
}

export function IdeAnimation() {
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [currentCharIndex, setCurrentCharIndex] = useState<number>(0)
  const [isTyping, setIsTyping] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getCurrentLine = useCallback(() => {
    return SCRIPT[visibleLines] || null
  }, [visibleLines])

  useEffect(() => {
    if (visibleLines >= SCRIPT.length) {
      // Loop: restart after a pause
      animationRef.current = setTimeout(() => {
        setVisibleLines(0)
        setCurrentCharIndex(0)
        setIsTyping(true)
      }, 4000)
      return () => {
        if (animationRef.current) clearTimeout(animationRef.current)
      }
    }

    const currentLine = getCurrentLine()
    if (!currentLine) return

    if (currentLine.type === "command") {
      // Type out commands character by character
      if (currentCharIndex < currentLine.text.length) {
        setIsTyping(true)
        const speed = 30 + Math.random() * 40
        animationRef.current = setTimeout(() => {
          setCurrentCharIndex((prev) => prev + 1)
        }, speed)
      } else {
        // Command fully typed, pause then move to next
        setIsTyping(false)
        animationRef.current = setTimeout(() => {
          setVisibleLines((prev) => prev + 1)
          setCurrentCharIndex(0)
        }, 400)
      }
    } else if (currentLine.type === "blank") {
      animationRef.current = setTimeout(() => {
        setVisibleLines((prev) => prev + 1)
        setCurrentCharIndex(0)
      }, 100)
    } else {
      // Output/status lines appear instantly with a small delay
      animationRef.current = setTimeout(() => {
        setVisibleLines((prev) => prev + 1)
        setCurrentCharIndex(0)
      }, 120)
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current)
    }
  }, [visibleLines, currentCharIndex, getCurrentLine])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleLines, currentCharIndex])

  return (
    <div className="relative rounded-lg border border-border/60 bg-card/60 glass overflow-hidden shadow-lg">
      {/* Title Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-secondary/30">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-500/60" />
          <div className="size-2.5 rounded-full bg-amber-500/60" />
          <div className="size-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/70 ml-2">
          DOAI-cli  ~  fleet-console
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[9px] text-emerald-500/70">{"● live"}</span>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={scrollRef}
        className="p-4 h-[320px] sm:h-[360px] overflow-y-auto scrollbar-hide"
      >
        <div className="font-mono text-[11px] sm:text-xs leading-[1.8] space-y-0">
          {SCRIPT.slice(0, visibleLines).map((line, i) => (
            <div key={`${i}-${line.text}`} className={cn("animate-fade-in", getLineClasses(line))}>
              {line.type === "command" && (
                <span className="text-muted-foreground/40 select-none">{"$ "}</span>
              )}
              {line.type === "blank" ? (
                <br />
              ) : (
                <span>{line.text}</span>
              )}
            </div>
          ))}

          {/* Currently typing line */}
          {visibleLines < SCRIPT.length && SCRIPT[visibleLines]?.type === "command" && (
            <div className="text-primary">
              <span className="text-muted-foreground/40 select-none">{"$ "}</span>
              <span>{SCRIPT[visibleLines].text.slice(0, currentCharIndex)}</span>
              {isTyping && (
                <span className="inline-block w-[6px] h-[14px] bg-primary ml-px animate-pulse align-middle" />
              )}
            </div>
          )}

          {/* Cursor at end when idle */}
          {visibleLines >= SCRIPT.length && (
            <div className="text-muted-foreground/40">
              <span className="select-none">{"$ "}</span>
              <span className="inline-block w-[6px] h-[14px] bg-primary/60 ml-px animate-pulse align-middle" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
