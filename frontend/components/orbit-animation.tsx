"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

const services = [
  {
    name: "YouTube",
    color: "#FF0000",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    name: "Netflix",
    color: "#E50914",
    path: "M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c.043.007.095.012.141.019V0zm-8.487 0v15.18l4.713 6.426V0z",
  },
  {
    name: "Spotify",
    color: "#1DB954",
    path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  },
  {
    name: "Twitch",
    color: "#9146FF",
    path: "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z",
  },
  {
    name: "TikTok",
    color: "#00F2EA",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  {
    name: "Apple Podcasts",
    color: "#9933CC",
    path: "M3.29 16.138A11.885 11.885 0 0 1 0 7.652 11.88 11.88 0 0 1 3.116.55a12.118 12.118 0 0 1 8.85-3.551A12.118 12.118 0 0 1 20.883.55 11.88 11.88 0 0 1 24 7.652a11.884 11.884 0 0 1-3.29 8.486l-.036.037c-.706.706-1.47 1.35-2.28 1.921l-.05.035a10.632 10.632 0 0 1-1.213.726c.156-.61.238-1.24.238-1.885v-1.135c.188-.152.37-.313.545-.482a9.544 9.544 0 0 0 2.82-6.803 9.544 9.544 0 0 0-2.82-6.804A9.777 9.777 0 0 0 11.966.852 9.778 9.778 0 0 0 5.064 3.75a9.544 9.544 0 0 0-2.82 6.803 9.544 9.544 0 0 0 2.82 6.804c.175.169.357.33.545.482v1.135c0 .646.082 1.275.238 1.885a10.6 10.6 0 0 1-1.213-.726l-.05-.035a13.768 13.768 0 0 1-2.28-1.921l-.035-.038zm4.58-2.043A7.553 7.553 0 0 1 5.63 8.63a7.59 7.59 0 0 1 2.247-5.418 7.806 7.806 0 0 1 4.09-2.12 7.806 7.806 0 0 1 4.09 2.12A7.59 7.59 0 0 1 18.304 8.63a7.553 7.553 0 0 1-2.24 5.465c-.198.193-.404.374-.619.542v-2.397a5.299 5.299 0 0 0 .56-1.032 5.214 5.214 0 0 0-.389-4.724 5.435 5.435 0 0 0-2.04-1.93 5.545 5.545 0 0 0-2.727-.72 5.545 5.545 0 0 0-2.727.72 5.435 5.435 0 0 0-2.04 1.93 5.214 5.214 0 0 0-.389 4.724c.142.36.332.703.56 1.032v2.397a7.355 7.355 0 0 1-.62-.542zM11.966 24c1.098 0 2.145-.3 3.06-.846v-6.182a2.867 2.867 0 0 0-.966-2.14 2.94 2.94 0 0 0-2.094-.857 2.94 2.94 0 0 0-2.094.856 2.867 2.867 0 0 0-.966 2.14v6.183A5.893 5.893 0 0 0 11.966 24zm0-11.15a2.413 2.413 0 0 0 1.738-.72 2.355 2.355 0 0 0 .718-1.718 2.355 2.355 0 0 0-.718-1.717 2.413 2.413 0 0 0-1.738-.72 2.413 2.413 0 0 0-1.738.72 2.355 2.355 0 0 0-.718 1.717c0 .658.258 1.27.718 1.718.46.46 1.08.72 1.738.72z",
  },
  {
    name: "X",
    color: "#A0A0A0",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  {
    name: "Medium",
    color: "#F97316",
    path: "M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z",
  },
]

function OrbitRing({
  radius,
  items,
  duration,
  reverse = false,
}: {
  radius: number
  items: typeof services
  duration: number
  reverse?: boolean
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        animation: `orbit-spin ${duration}s linear infinite ${reverse ? "reverse" : ""}`,
      }}
    >
      {/* Orbit path */}
      <div
        className="absolute rounded-full border border-border/20"
        style={{
          width: radius * 2,
          height: radius * 2,
          top: `calc(50% - ${radius}px)`,
          left: `calc(50% - ${radius}px)`,
        }}
      />

      {/* Orbiting items */}
      {items.map((item, i) => {
        const angle = (i / items.length) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius

        return (
          <div
            key={item.name}
            className="absolute flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              top: `calc(50% + ${y}px - 22px)`,
              left: `calc(50% + ${x}px - 22px)`,
              animation: `orbit-spin ${duration}s linear infinite ${reverse ? "" : "reverse"}`,
            }}
          >
            <div
              className="group relative flex size-10 items-center justify-center rounded-full border border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:scale-125 hover:border-primary/60 cursor-default"
              style={{ boxShadow: `0 0 12px ${item.color}15` }}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill={item.color}
                aria-hidden="true"
              >
                <path d={item.path} />
              </svg>
              {/* Tooltip */}
              <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-card/90 px-2 py-0.5 font-mono text-[8px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 border border-border/30">
                {item.name}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function OrbitAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-[400px] mx-auto">
      {/* Central Sphere */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative flex size-20 items-center justify-center rounded-full border border-primary/40 bg-primary/10 backdrop-blur-md">
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-primary/20 via-transparent to-primary/5" />
          <span className="relative font-mono text-sm font-bold text-primary tracking-wider">
            DOAI
          </span>
        </div>
        <div className="absolute -inset-3 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="absolute -inset-1.5 rounded-full border border-primary/20" />
      </div>

      {/* Inner orbit: 4 services */}
      <OrbitRing
        radius={100}
        items={services.slice(0, 4)}
        duration={25}
      />

      {/* Outer orbit: 4 services */}
      <OrbitRing
        radius={170}
        items={services.slice(4)}
        duration={40}
        reverse
      />

      {/* Subtle decorative rings */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" className="text-primary" />
        <circle cx="200" cy="200" r="170" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" className="text-primary" />
      </svg>

      <style jsx>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
