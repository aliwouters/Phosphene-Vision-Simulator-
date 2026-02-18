"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { CameraFeed } from "@/components/camera-feed"
import { BrightnessMatrix } from "@/components/brightness-matrix"
import { PhospheneGrid } from "@/components/phosphene-grid"

const OccipitalHeatmap = dynamic(
  () =>
    import("@/components/occipital-heatmap").then((mod) => mod.OccipitalHeatmap),
  { ssr: false }
)

const GRID_SIZES = [8, 12, 16, 24, 32]

export default function Page() {
  const [gridSize, setGridSize] = useState(16)
  const [matrix, setMatrix] = useState<number[][]>([])

  const handleMatrixUpdate = useCallback((newMatrix: number[][]) => {
    setMatrix(newMatrix)
  }, [])

  return (
    <main className="min-h-screen bg-background p-4 lg:p-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-mono font-semibold tracking-tight text-foreground lg:text-2xl">
            Phosphene Vision Simulator
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground lg:text-sm">
            Real-time camera brightness to phosphene map visualization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="grid-size"
            className="font-mono text-xs text-muted-foreground"
          >
            Grid
          </label>
          <div className="flex gap-1" role="radiogroup" aria-label="Grid size">
            {GRID_SIZES.map((size) => (
              <button
                key={size}
                role="radio"
                aria-checked={gridSize === size}
                onClick={() => setGridSize(size)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  gridSize === size
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <CameraFeed gridSize={gridSize} onMatrixUpdate={handleMatrixUpdate} />
        <BrightnessMatrix matrix={matrix} gridSize={gridSize} />
        <PhospheneGrid matrix={matrix} gridSize={gridSize} />
        <OccipitalHeatmap matrix={matrix} gridSize={gridSize} />
      </div>
    </main>
  )
}
