"use client"

import { useRef, useEffect, useState } from "react"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

// Declare the model-viewer custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          "camera-controls"?: boolean | string
          "tone-mapping"?: string
          exposure?: string
          "shadow-intensity"?: string
          "camera-target"?: string
          "camera-orbit"?: string
          "min-camera-orbit"?: string
          "max-camera-orbit"?: string
          "field-of-view"?: string
          "min-field-of-view"?: string
          "max-field-of-view"?: string
          "interaction-prompt"?: string
          style?: React.CSSProperties
        },
        HTMLElement
      >
    }
  }
}

// Heatmap color: cold blue -> cyan -> green -> yellow -> white-hot
function heatColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  if (v < 0.2) {
    const f = v / 0.2
    return [lerp(8, 15, f), lerp(12, 60, f), lerp(60, 110, f)]
  }
  if (v < 0.4) {
    const f = (v - 0.2) / 0.2
    return [lerp(15, 20, f), lerp(60, 180, f), lerp(110, 170, f)]
  }
  if (v < 0.6) {
    const f = (v - 0.4) / 0.2
    return [lerp(20, 160, f), lerp(180, 230, f), lerp(170, 50, f)]
  }
  if (v < 0.8) {
    const f = (v - 0.6) / 0.2
    return [lerp(160, 255, f), lerp(230, 180, f), lerp(50, 30, f)]
  }
  const f = (v - 0.8) / 0.2
  return [lerp(255, 255, f), lerp(180, 245, f), lerp(30, 220, f)]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function OccipitalHeatmap3D({
  matrix,
  gridRows,
  gridCols,
}: OccipitalHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoaded = useRef(false)
  const [ready, setReady] = useState(false)

  // Load the model-viewer script from CDN
  useEffect(() => {
    if (scriptLoaded.current) {
      setReady(true)
      return
    }

    // Check if already loaded
    if (customElements.get("model-viewer")) {
      scriptLoaded.current = true
      setReady(true)
      return
    }

    const script = document.createElement("script")
    script.type = "module"
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
    script.onload = () => {
      scriptLoaded.current = true
      setReady(true)
    }
    script.onerror = () => {
      console.error("[v0] Failed to load model-viewer script")
    }
    document.head.appendChild(script)

    return () => {
      // Don't remove the script on cleanup -- it should persist
    }
  }, [])

  // Draw heatmap legend on a canvas overlay showing what region maps where
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || matrix.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Draw a small retinotopic key in the corner
    const keySize = Math.min(w, h) * 0.35
    const keyX = w - keySize - 8
    const keyY = h - keySize - 8
    const cellW = keySize / gridCols
    const cellH = keySize / gridRows

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
    ctx.strokeStyle = "rgba(0, 210, 160, 0.3)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(keyX - 4, keyY - 18, keySize + 8, keySize + 22, 4)
    ctx.fill()
    ctx.stroke()

    ctx.font = "9px monospace"
    ctx.fillStyle = "rgba(0, 210, 160, 0.7)"
    ctx.textAlign = "left"
    ctx.fillText("V1 heatmap", keyX, keyY - 6)

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (matrix[row] && matrix[row][col] !== undefined) {
          const value = matrix[row][col]
          const normalized = (value - 2) / 75
          const [r, g, b] = heatColor(normalized)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`
          ctx.fillRect(
            keyX + col * cellW,
            keyY + row * cellH,
            cellW + 0.5,
            cellH + 0.5
          )
        }
      }
    }
  }, [matrix, gridRows, gridCols])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          Occipital Cortex Map (3D)
        </h2>
      </div>
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810]"
      >
        {ready ? (
          <model-viewer
            src="/models/full_brain_binary.glb"
            camera-controls
            tone-mapping="neutral"
            exposure="0.47"
            shadow-intensity="1"
            camera-target="-66.89m 8.88m -6.95m"
            camera-orbit="180deg 90deg 200m"
            min-camera-orbit="auto auto 10m"
            max-camera-orbit="auto auto 2000m"
            min-field-of-view="5deg"
            max-field-of-view="120deg"
            interaction-prompt="none"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#060810",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--poster-color" as any]: "#060810",
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              Loading 3D viewer...
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={300}
          height={225}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        />
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          drag to rotate / scroll to zoom
        </div>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="text-[10px]">low stimulus</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(8, 12, 60)" }} />
          <div className="flex-1" style={{ background: "rgb(15, 60, 110)" }} />
          <div
            className="flex-1"
            style={{ background: "rgb(20, 180, 170)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(160, 230, 50)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(255, 180, 30)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(255, 245, 220)" }}
          />
        </div>
        <span className="text-[10px]">high stimulus</span>
      </div>
    </div>
  )
}
