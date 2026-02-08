"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 페이지 전환 시 상단 얇은 프로그레스 바 (1개)
 */
export function GlobalLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 0);
    const t2 = setTimeout(() => setVisible(false), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-hidden
    />
  );
}
