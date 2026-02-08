"use client"

import { useEffect, useState } from "react"

const DELAY_MS = 3000

interface LoadingDelayMessageProps {
  message?: string
  showAfterMs?: number
  className?: string
}

/**
 * API 300ms 이상이면 로더 표시는 부모에서 처리.
 * 3초 이상 지연 시 "지연 안내 문구" 표시 (예: "기기 상태를 불러오는 중…")
 */
export function LoadingDelayMessage({
  message = "데이터를 불러오는 중…",
  showAfterMs = DELAY_MS,
  className = "",
}: LoadingDelayMessageProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), showAfterMs)
    return () => clearTimeout(t)
  }, [showAfterMs])

  if (!show) return null
  return (
    <p className={`text-sm text-muted-foreground ${className}`} role="status">
      {message}
    </p>
  )
}
