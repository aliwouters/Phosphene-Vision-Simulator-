"use client"

import { useRef, useEffect } from "react"

interface PhospheneGridProps {
  matrix: number[][]
  gridSize: number
}

export function PhospheneGrid({ matrix, gridSize }: PhospheneGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || matrix.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height

    ctx.fillStyle = "#080a0f"
    ctx.fillRect(0, 0, width, height)

    const cellW = width / gridSize
    const cellH = height / gridSize
    const maxRadius = Math.min(cellW, cellH) * 0.4

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!matrix[row] || matrix[row][col] === undefined) continue

        const value = matrix[row][col]
        const linear = (value - 2) / 75
        // Steep power curve: darks nearly vanish, brights punch hard
        const normalized = Math.pow(linear, 2.2)

        const cx = col * cellW + cellW / 2
        const cy = row * cellH + cellH / 2
        // Tiny dots for dark values, full-size for bright
        const radius = maxRadius * (0.1 + normalized * 0.9)
        // Outer glow radius extends further for bright dots
        const glowRadius = radius * (1.0 + normalized * 1.5)

        // Color: shift from dim blue-grey to hot white
        const intensity = Math.round(normalized * 255)
        const glowR = Math.min(255, Math.round(intensity * 0.7 + normalized * 80))
        const glowG = Math.min(255, intensity)
        const glowB = Math.min(255, Math.round(intensity * 0.85 + normalized * 40))

        // Outer soft glow (only visible on brighter dots)
        if (normalized > 0.05) {
          const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, glowRadius)
          outerGlow.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${normalized * 0.3})`)
          outerGlow.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
          ctx.fillStyle = outerGlow
          ctx.fill()
        }

        // Main dot body
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        gradient.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${normalized * 1.0})`)
        gradient.addColorStop(0.5, `rgba(${glowR}, ${glowG}, ${glowB}, ${normalized * 0.6})`)
        gradient.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Hot white core for bright values
        if (normalized > 0.15) {
          const coreRadius = radius * 0.35
          const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius)
          const coreAlpha = Math.min(1.0, normalized * 1.2)
          coreGradient.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`)
          coreGradient.addColorStop(0.5, `rgba(255, 255, 255, ${coreAlpha * 0.4})`)
          coreGradient.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
          ctx.fillStyle = coreGradient
          ctx.fill()
        }
      }
    }
  }, [matrix, gridSize])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Phosphene Map
        </h2>
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#080a0f]">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ imageRendering: "auto" }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground opacity-30" />
          dim
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
          bright
        </span>
      </div>
    </div>
  )
}
