"use client"

interface BrightnessMatrixProps {
  matrix: number[][]
  gridSize: number
}

export function BrightnessMatrix({ matrix, gridSize }: BrightnessMatrixProps) {
  const getColor = (value: number) => {
    const normalized = (value - 2) / 75
    // Apply a power curve for more visual contrast between dark and bright
    const curved = Math.pow(normalized, 0.6)
    const lightness = 0.12 + curved * 0.88

    if (normalized > 0.6) {
      // Bright values get a strong teal tint
      const chroma = 0.08 + (normalized - 0.6) * 0.3
      return `oklch(${lightness} ${chroma} 165)`
    }
    if (normalized < 0.2) {
      // Dark values get a subtle blue tint
      return `oklch(${lightness} 0.03 260)`
    }
    return `oklch(${lightness} 0.02 200)`
  }

  const getCellBg = (value: number) => {
    const normalized = (value - 2) / 75
    // Subtle background glow for brighter cells
    const bgLight = 0.12 + normalized * 0.06
    const bgChroma = normalized > 0.5 ? 0.01 + normalized * 0.02 : 0.005
    return `oklch(${bgLight} ${bgChroma} 200)`
  }

  const getFontSize = () => {
    if (gridSize <= 8) return "text-xs"
    if (gridSize <= 12) return "text-[10px]"
    if (gridSize <= 16) return "text-[8px]"
    return "text-[6px]"
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Brightness Matrix
        </h2>
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary p-1">
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            gap: "1px",
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
            : Array.from({ length: gridSize * gridSize }).map((_, i) => (
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
        <span>2 = dark</span>
        <span>77 = bright</span>
      </div>
    </div>
  )
}
