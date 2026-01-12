"use client"

import { useEffect, useRef } from "react"

interface RainAnimationProps {
  opacity?: number
  className?: string
}

export function RainAnimation({ opacity = 0.15, className }: RainAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const drops: { x: number; y: number; length: number; speed: number; opacity: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createDrop = () => {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * -100,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 8 + 4,
        opacity: Math.random() * 0.5 + 0.1,
      }
    }

    const initDrops = () => {
      for (let i = 0; i < 150; i++) {
        const drop = createDrop()
        drop.y = Math.random() * canvas.height
        drops.push(drop)
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]

        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x - 0.5, drop.y + drop.length)
        ctx.strokeStyle = `rgba(242, 203, 5, ${drop.opacity})`
        ctx.lineWidth = 1
        ctx.stroke()

        drop.y += drop.speed
        drop.x -= 0.2

        if (drop.y > canvas.height) {
          drops[i] = createDrop()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    resize()
    initDrops()
    window.addEventListener("resize", resize)
    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none z-[5] ${className ?? ""}`}
      style={{ opacity }}
    />
  )
}
