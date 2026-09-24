"use client"

import { useState, useCallback } from "react"
import { CameraFeed } from "@/components/camera-feed"
import { BrightnessMatrix } from "@/components/brightness-matrix"
import { PhospheneGrid } from "@/components/phosphene-grid"
import { CalcarineViewer } from "@/components/calcarine-viewer"

const GRID_SIZES = [8, 12, 16, 24, 32]

interface DevicePreset {
  name: string
  rows: number
  cols: number
  /** What the electrode/pixel count is inspired by, for the tooltip. */
  note: string
}

// Presets only change the GRID RESOLUTION to echo the electrode/pixel count of
// a real device. They do not reproduce any device's electrode layout,
// stimulation strategy, or the vision it produces. Counts are drawn from the
// cited literature (see README). Argus II and PRIMA stimulate the retina; the
// Utah-array preset and the V1 map concern the visual cortex.
const DEVICE_PRESETS: DevicePreset[] = [
  { name: "Argus II", rows: 6, cols: 10, note: "60-electrode epiretinal array (da Cruz et al., 2016). Retinal, not cortical." },
  { name: "PRIMA", rows: 19, cols: 19, note: "~378 photovoltaic subretinal pixels (Palanker et al., 2020), shown as a 19x19 grid approximation. Retinal, not cortical." },
  { name: "Utah 96ch", rows: 10, cols: 10, note: "96-channel intracortical array in V1 (Fernández et al., 2021), shown as a 10x10 grid." },
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
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-mono font-semibold tracking-tight text-foreground lg:text-2xl">
            Phosphene Vision Simulator
          </h1>
          <p className="max-w-3xl text-pretty text-xs leading-relaxed text-muted-foreground">
            An educational simulation of how a camera-driven visual prosthesis could map a
            scene onto primary visual cortex. It is <span className="text-foreground">not</span>{" "}
            a validated prediction of artificial vision and{" "}
            <span className="text-foreground">not</span> a tool for choosing safe
            stimulation parameters. Panels are labeled{" "}
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">approximation</span>{" "}
            (math),{" "}
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">schematic</span>{" "}
            (conceptual), or{" "}
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">illustrative</span>{" "}
            (for legibility). See the README for equations, assumptions, and references.
          </p>
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
              Device-inspired grids
            </label>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Device-inspired grid preset">
              {DEVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  role="radio"
                  aria-checked={activePreset === preset.name}
                  onClick={() => handlePreset(preset)}
                  title={preset.note}
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
            <p className="max-w-md font-mono text-[10px] leading-relaxed text-muted-foreground/70">
              Presets only set the grid resolution to echo each device&apos;s electrode or
              pixel count. They do not reproduce a device&apos;s layout, stimulation, or
              perceived vision. Hover for sources.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <CameraFeed gridRows={gridRows} gridCols={gridCols} onMatrixUpdate={handleMatrixUpdate} />
        <BrightnessMatrix matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
        <PhospheneGrid matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
        <CalcarineViewer matrix={matrix} gridRows={gridRows} gridCols={gridCols} />
      </div>
    </main>
  )
}
