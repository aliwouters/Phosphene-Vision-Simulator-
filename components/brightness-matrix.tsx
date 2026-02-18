"use client"

interface BrightnessMatrixProps {
  matrix: number[][]
  gridSize: number
}

export function BrightnessMatrix({ matrix, gridSize }: BrightnessMatrixProps) {
  const getColor = (value: number) => {
    const normalized = (value - 2) / 75
    const lightness = 0.2 + normalized * 0.7
    if (normalized > 0.7) {
      return `oklch(${lightness} 0.12 165)`
    }
    return `oklch(${lightness} 0.01 260)`
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
                      backgroundColor:
                        "oklch(0.15 0.005 260)",
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
