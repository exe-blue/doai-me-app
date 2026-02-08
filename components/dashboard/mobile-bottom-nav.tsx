"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Smartphone,
  Play,
  Brain,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "홈", href: "/dashboard", icon: Home },
  { label: "기기", href: "/dashboard/devices", icon: Smartphone },
  { label: "콘텐츠", href: "/dashboard/videos", icon: Play },
  { label: "실행", href: "/dashboard/runs", icon: Brain },
  { label: "기록", href: "/dashboard/artifacts", icon: Archive },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-sm md:hidden">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition-colors",
            isActive(item.href)
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          <item.icon className="size-5" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
