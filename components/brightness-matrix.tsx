"use client"

import { LearnMore } from "./learn-more"

interface BrightnessMatrixProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

export function BrightnessMatrix({ matrix, gridRows, gridCols }: BrightnessMatrixProps) {
  const getColor = (value: number) => {
    const normalized = (value - 2) / 75
    const curved = Math.pow(normalized, 0.6)
    const lightness = 0.12 + curved * 0.88

    if (normalized > 0.6) {
      const chroma = 0.08 + (normalized - 0.6) * 0.3
      return `oklch(${lightness} ${chroma} 165)`
    }
    if (normalized < 0.2) {
      return `oklch(${lightness} 0.03 260)`
    }
    return `oklch(${lightness} 0.02 200)`
  }

  const getCellBg = (value: number) => {
    const normalized = (value - 2) / 75
    const bgLight = 0.12 + normalized * 0.06
    const bgChroma = normalized > 0.5 ? 0.01 + normalized * 0.02 : 0.005
    return `oklch(${bgLight} ${bgChroma} 200)`
  }

  const totalCells = gridRows * gridCols
  const getFontSize = () => {
    if (totalCells <= 64) return "text-xs"
    if (totalCells <= 144) return "text-[10px]"
    if (totalCells <= 256) return "text-[8px]"
    if (totalCells <= 600) return "text-[6px]"
    if (totalCells <= 1024) return "text-[4px]"
    return "text-[3px]"
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Amplitude Matrix
        </h2>
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary p-1">
        <div
          className="grid h-full w-full -scale-x-100"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            gap: totalCells > 400 ? "0px" : "1px",
          }}
        >
          {matrix.length > 0
            ? matrix.flatMap((row, rowIdx) =>
                row.map((value, colIdx) => (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`flex items-center justify-center font-mono ${getFontSize()} leading-none rounded-[1px]`}
                    style={{
                      color: getColor(value),
                      backgroundColor: getCellBg(value),
                    }}
                  >
                    {value}
                  </div>
                ))
              )
            : Array.from({ length: totalCells }).map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center font-mono ${getFontSize()} leading-none text-muted-foreground rounded-[1px]`}
                  style={{ backgroundColor: "oklch(0.15 0.005 260)" }}
                >
                  --
                </div>
              ))}
        </div>
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{'2\u00A0\u03BCA = dark'}</span>
        <span>{'77\u00A0\u03BCA = bright'}</span>
      </div>
      <LearnMore>
        <p className="mb-1.5">
          An external processor simplifies the video into a grid of average brightness
          values that matches the layout of the implanted electrode array. Each square
          in the grid controls the electrical current sent to one electrode.
        </p>
        <p className="mb-1.5">
          The electrodes stimulate neurons in the visual cortex (V1) using currents
          between 2 and 77 microamps ({'\u03BCA'}). Lower currents create faint spots
          of light (phosphenes), while higher currents create brighter ones.
        </p>
        <p>
          By converting brightness in each part of the image into a specific current
          level, the system turns the visual scene into a pattern of electrical signals
          that the brain can understand.
        </p>
      </LearnMore>
    </div>
  )
}
