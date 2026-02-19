"use client"

import { useRef, useEffect } from "react"

interface PhospheneGridProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

export function PhospheneGrid({ matrix, gridRows, gridCols }: PhospheneGridProps) {
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

    const cellW = width / gridCols
    const cellH = height / gridRows
    const maxRadius = Math.min(cellW, cellH) * 0.4

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (!matrix[row] || matrix[row][col] === undefined) continue

        const value = matrix[row][col]
        const normalized = (value - 2) / 75

        const cx = col * cellW + cellW / 2
        const cy = row * cellH + cellH / 2
        const radius = maxRadius * (0.3 + normalized * 0.7)

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)

        const intensity = Math.round(normalized * 255)
        const glowR = Math.round(intensity * 0.85)
        const glowG = intensity
        const glowB = Math.round(intensity * 0.9)

        gradient.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${0.3 + normalized * 0.7})`)
        gradient.addColorStop(0.4, `rgba(${glowR}, ${glowG}, ${glowB}, ${0.15 + normalized * 0.4})`)
        gradient.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        if (normalized > 0.3) {
          const coreRadius = radius * 0.25
          const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius)
          coreGradient.addColorStop(0, `rgba(255, 255, 255, ${normalized * 0.6})`)
          coreGradient.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
          ctx.beginPath()
          ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2)
          ctx.fillStyle = coreGradient
          ctx.fill()
        }
      }
    }
  }, [matrix, gridRows, gridCols])

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
