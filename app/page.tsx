"use client"

import { useState, useCallback } from "react"
import { CameraFeed } from "@/components/camera-feed"
import { BrightnessMatrix } from "@/components/brightness-matrix"
import { PhospheneGrid } from "@/components/phosphene-grid"
import dynamic from "next/dynamic"

const OccipitalHeatmap3D = dynamic(
  () => import("@/components/brain-3d-viewer").then((mod) => mod.OccipitalHeatmap3D),
  { ssr: false, loading: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          Occipital Cortex Map (3D)
        </h2>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810] flex items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground animate-pulse">Loading 3D viewer...</p>
      </div>
    </div>
  )}
)

const GRID_SIZES = [8, 12, 16, 24, 32]

interface DevicePreset {
  name: string
  rows: number
  cols: number
}

const DEVICE_PRESETS: DevicePreset[] = [
  { name: "PRIMA System", rows: 19, cols: 19 },
  { name: "Argus II", rows: 6, cols: 10 },
  { name: "BVA Wide-View", rows: 8, cols: 12 },
  { name: "BVA High-Acuity", rows: 25, cols: 40 },
]

export default function Page() {
  const [gridRows, setGridRows] = useState(32)
  const [gridCols, setGridCols] = useState(32)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<number[][]>([])

  const handleMatrixUpdate = useCallback((newMatrix: number[][]) => {
    setMatrix(newMatrix)
  }, [])

  const handleSquareGrid = (size: number) => {
    setGridRows(size)
    setGridCols(size)
    setActivePreset(null)
  }

  const handlePreset = (preset: DevicePreset) => {
    setGridRows(preset.rows)
    setGridCols(preset.cols)
    setActivePreset(preset.name)
  }

  return (
    <main className="min-h-screen bg-background p-4 lg:p-6">
      <header className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-mono font-semibold tracking-tight text-foreground lg:text-2xl">
            Phosphene Vision Simulator
          </h1>

        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Grid Sizes
            </label>
            <div className="flex gap-1" role="radiogroup" aria-label="Grid size">
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  role="radio"
                  aria-checked={gridRows === size && gridCols === size && !activePreset}
                  onClick={() => handleSquareGrid(size)}
                  className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                    gridRows === size && gridCols === size && !activePreset
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground"
                  }`}
                >
                  {size}x{size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Known Products
            </label>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Device preset">
              {DEVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  role="radio"
                  aria-checked={activePreset === preset.name}
                  onClick={() => handlePreset(preset)}
                  className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                    activePreset === preset.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground"
                  }`}
                >
                  {preset.name}
                  <span className="ml-1 opacity-50">
                    {preset.rows}x{preset.cols}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <CameraFeed gridRows={gridRows} gridCols={gridCols} onMatrixUpdate={handleMatrixUpdate} />
        <BrightnessMatrix matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
        <PhospheneGrid matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
        <OccipitalHeatmap3D matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
      </div>
    </main>
  )
}
