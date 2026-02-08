"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"
import Link from "next/link"

const mainNavItems = [
  { label: "오버뷰", href: "/#overview" },
  { label: "디바이스=실체", href: "/#devices" },
  { label: "컨텐츠", href: "/#videos" },
  { label: "실행", href: "/#runs" },
  { label: "로그", href: "/#artifacts" },
]

const moreNavItems = [
  { label: "학문적 근거", href: "/#philosophy" },
  { label: "기술적 구현", href: "/#tech" },
]

export function Header() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close more dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isScrolled ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-sm" : "bg-transparent",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-primary/50 bg-primary/10 font-mono text-sm text-primary transition-all duration-400 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/25">
              <span className="font-bold text-xs">D</span>
            </div>
            <span className="font-mono text-sm tracking-tight">
              DoAi
              <span className="bg-gradient-to-l from-primary/50 to-accent bg-clip-text text-transparent font-semibold">
                .Me
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {mainNavItems.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative px-3 py-2.5 text-xs tracking-wide transition-all duration-300 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  hoveredIndex === index && "text-foreground",
                )}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span>{item.label}</span>
              </Link>
            ))}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={cn(
                  "relative flex items-center justify-center px-2.5 py-2.5 text-xs tracking-wide transition-all duration-300 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  isMoreOpen && "text-foreground bg-secondary/50",
                )}
                aria-label="더보기"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="13" cy="8" r="1.5" fill="currentColor" />
                </svg>
              </button>
              {isMoreOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-border/60 bg-background/95 backdrop-blur-xl shadow-lg py-1 z-50 animate-fade-in">
                  {moreNavItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/50"
                    >
                      <span className="text-primary font-mono text-[10px]">{">"}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 font-mono text-xs text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
            >
              {"콘솔 열기"}
            </Link>
            <Link
              href="/#philosophy"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono text-xs text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground"
            >
              {"봇이 아닌 이유"}
            </Link>
            <ThemeToggle />

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/50 lg:hidden transition-colors hover:bg-secondary"
              aria-label="Toggle menu"
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span
                  className={cn(
                    "h-0.5 bg-foreground transition-all duration-300 origin-center",
                    isMobileMenuOpen ? "w-5 translate-y-2 rotate-45" : "w-5",
                  )}
                />
                <span
                  className={cn(
                    "h-0.5 w-3.5 bg-foreground transition-all duration-300",
                    isMobileMenuOpen && "opacity-0 translate-x-2",
                  )}
                />
                <span
                  className={cn(
                    "h-0.5 bg-foreground transition-all duration-300 origin-center",
                    isMobileMenuOpen ? "w-5 -translate-y-2 -rotate-45" : "w-5",
                  )}
                />
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div
          className={cn(
            "transition-all duration-400 lg:hidden bg-background",
            isMobileMenuOpen ? "max-h-[600px] opacity-100 pt-4" : "max-h-0 opacity-0 overflow-hidden",
          )}
        >
          <div className="flex flex-col gap-1 border-t border-border/50 pt-4">
            {[...mainNavItems, ...moreNavItems].map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3.5 text-sm text-muted-foreground transition-all duration-200 active:bg-secondary hover:text-foreground hover:bg-secondary/50"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-primary font-mono text-xs">{">"}</span>
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4 px-4 pb-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-3 font-mono text-xs text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
              >
                {"콘솔 열기"}
              </Link>
              <Link
                href="/#philosophy"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-mono text-xs text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground"
              >
                {"봇이 아닌 이유"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
