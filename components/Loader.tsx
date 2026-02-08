"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoaderProps {
  /** 300ms 이상 지속 시 표시 권장 */
  show?: boolean;
  /** 3초 이상 시 "연결 확인 중…" 문구 추가 */
  longDelayMessage?: string;
  /** 요청 시작 시점 (ms). 없으면 show만 사용 */
  startTime?: number;
  className?: string;
}

export function Loader({
  show = true,
  longDelayMessage = "연결 확인 중…",
  startTime,
  className,
}: LoaderProps) {
  const [showLongMessage, setShowLongMessage] = useState(false);

  useEffect(() => {
    if (!show || startTime == null) return;
    const t = setTimeout(() => setShowLongMessage(true), 3000);
    return () => clearTimeout(t);
  }, [show, startTime]);

  if (!show) return null;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-muted-foreground", className)}>
      <Loader2 className="size-5 animate-spin" />
      {showLongMessage && <span className="text-xs">{longDelayMessage}</span>}
    </div>
  );
}
