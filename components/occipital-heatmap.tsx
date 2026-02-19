"use client"

import { useRef, useEffect, useState, useCallback } from "react"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Draw a smooth brain silhouette (medial sagittal view)
function drawBrainOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotY: number,
  rotX: number
) {
  // Apply perspective foreshortening based on Y rotation
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale

  // Slight vertical shift from X rotation
  const shiftY = Math.sin(rotX) * scale * 0.15

  ctx.save()
  ctx.translate(cx, cy + shiftY)

  // Brain outline path (medial view) 
  ctx.beginPath()
  // Start at frontal base
  ctx.moveTo(-1.9 * scaleX, 0.1 * scaleY)

  // Frontal lobe upper curve
  ctx.bezierCurveTo(
    -1.85 * scaleX, -0.9 * scaleY,
    -1.2 * scaleX, -1.55 * scaleY,
    -0.3 * scaleX, -1.6 * scaleY
  )

  // Top of parietal
  ctx.bezierCurveTo(
    0.3 * scaleX, -1.6 * scaleY,
    0.9 * scaleX, -1.45 * scaleY,
    1.3 * scaleX, -1.1 * scaleY
  )

  // Parietal-occipital transition
  ctx.bezierCurveTo(
    1.6 * scaleX, -0.8 * scaleY,
    1.8 * scaleX, -0.45 * scaleY,
    1.85 * scaleX, -0.05 * scaleY
  )

  // Occipital pole
  ctx.bezierCurveTo(
    1.88 * scaleX, 0.25 * scaleY,
    1.8 * scaleX, 0.55 * scaleY,
    1.55 * scaleX, 0.75 * scaleY
  )

  // Cerebellum notch
  ctx.bezierCurveTo(
    1.3 * scaleX, 0.9 * scaleY,
    1.0 * scaleX, 1.05 * scaleY,
    0.6 * scaleX, 1.0 * scaleY
  )

  // Inferior temporal
  ctx.bezierCurveTo(
    0.2 * scaleX, 0.95 * scaleY,
    -0.3 * scaleX, 0.85 * scaleY,
    -0.7 * scaleX, 0.8 * scaleY
  )

  // Brain stem area
  ctx.bezierCurveTo(
    -1.1 * scaleX, 0.75 * scaleY,
    -1.5 * scaleX, 0.6 * scaleY,
    -1.7 * scaleX, 0.4 * scaleY
  )

  // Close frontal base
  ctx.bezierCurveTo(
    -1.85 * scaleX, 0.25 * scaleY,
    -1.9 * scaleX, 0.15 * scaleY,
    -1.9 * scaleX, 0.1 * scaleY
  )

  ctx.closePath()
  ctx.restore()
}

// Draw the V1/occipital lobe region
function drawOccipitalRegion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotY: number,
  rotX: number
) {
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale
  const shiftY = Math.sin(rotX) * scale * 0.15

  ctx.save()
  ctx.translate(cx, cy + shiftY)

  ctx.beginPath()

  // Anterior boundary of V1 (roughly parieto-occipital sulcus)
  ctx.moveTo(0.65 * scaleX, -0.05 * scaleY)

  // Dorsal bank to posterior pole
  ctx.bezierCurveTo(
    0.85 * scaleX, -0.65 * scaleY,
    1.4 * scaleX, -0.95 * scaleY,
    1.75 * scaleX, -0.55 * scaleY
  )

  // Around occipital pole
  ctx.bezierCurveTo(
    1.88 * scaleX, -0.05 * scaleY,
    1.85 * scaleX, 0.35 * scaleY,
    1.6 * scaleX, 0.65 * scaleY
  )

  // Ventral bank back to anterior
  ctx.bezierCurveTo(
    1.3 * scaleX, 0.85 * scaleY,
    0.85 * scaleX, 0.6 * scaleY,
    0.65 * scaleX, -0.05 * scaleY
  )

  ctx.closePath()
  ctx.restore()
}

// Get the bounding box of V1 region for heatmap mapping
function getV1Bounds(cx: number, cy: number, scale: number, rotY: number, rotX: number) {
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale
  const shiftY = Math.sin(rotX) * scale * 0.15

  return {
    left: cx + 0.55 * scaleX,
    right: cx + 1.9 * scaleX,
    top: cy + shiftY - 1.0 * scaleY,
    bottom: cy + shiftY + 0.9 * scaleY,
    cx,
    cy: cy + shiftY,
    scaleX,
    scaleY,
  }
}

// Draw calcarine sulcus
function drawCalcarine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotY: number,
  rotX: number
) {
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale
  const shiftY = Math.sin(rotX) * scale * 0.15

  ctx.save()
  ctx.translate(cx, cy + shiftY)

  ctx.beginPath()
  ctx.moveTo(0.65 * scaleX, -0.02 * scaleY)
  ctx.bezierCurveTo(
    0.9 * scaleX, 0.0 * scaleY,
    1.3 * scaleX, 0.02 * scaleY,
    1.82 * scaleX, 0.0 * scaleY
  )

  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.restore()
}

// Draw sulci lines on the brain surface for realism
function drawSulci(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotY: number,
  rotX: number
) {
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale
  const shiftY = Math.sin(rotX) * scale * 0.15

  ctx.save()
  ctx.translate(cx, cy + shiftY)
  ctx.strokeStyle = "rgba(100, 120, 150, 0.2)"
  ctx.lineWidth = 1

  // Central sulcus
  ctx.beginPath()
  ctx.moveTo(0.35 * scaleX, -1.5 * scaleY)
  ctx.bezierCurveTo(
    0.25 * scaleX, -1.0 * scaleY,
    0.15 * scaleX, -0.3 * scaleY,
    -0.1 * scaleX, 0.3 * scaleY
  )
  ctx.stroke()

  // Sylvian fissure
  ctx.beginPath()
  ctx.moveTo(-0.1 * scaleX, 0.2 * scaleY)
  ctx.bezierCurveTo(
    -0.5 * scaleX, 0.05 * scaleY,
    -1.0 * scaleX, -0.1 * scaleY,
    -1.4 * scaleX, -0.05 * scaleY
  )
  ctx.stroke()

  // Parieto-occipital sulcus
  ctx.beginPath()
  ctx.moveTo(0.65 * scaleX, -1.35 * scaleY)
  ctx.bezierCurveTo(
    0.7 * scaleX, -0.8 * scaleY,
    0.68 * scaleX, -0.3 * scaleY,
    0.65 * scaleX, 0.0 * scaleY
  )
  ctx.strokeStyle = "rgba(0, 210, 160, 0.35)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

// Draw an arrow line from a label position to a target point on the brain
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
) {
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 2) return

  // Shorten the line slightly at each end
  const shortenStart = 4
  const shortenEnd = 6
  const nx = dx / dist
  const ny = dy / dist
  const sx = fromX + nx * shortenStart
  const sy = fromY + ny * shortenStart
  const ex = toX - nx * shortenEnd
  const ey = toY - ny * shortenEnd

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.setLineDash([])

  // Small arrowhead
  const headLen = 6
  const angle = Math.atan2(ey - sy, ex - sx)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(
    ex - headLen * Math.cos(angle - Math.PI / 6),
    ey - headLen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    ex - headLen * Math.cos(angle + Math.PI / 6),
    ey - headLen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Draw labels outside the brain with arrows pointing inward
function drawLabels(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  rotY: number,
  rotX: number
) {
  const cosY = Math.cos(rotY)
  const scaleX = scale * Math.max(0.3, Math.abs(cosY))
  const scaleY = scale
  const shiftY = Math.sin(rotX) * scale * 0.15

  ctx.save()
  ctx.translate(cx, cy + shiftY)

  const lobeFont = `${Math.max(10, scale * 0.12)}px monospace`
  const lobeColor = "rgba(140, 160, 185, 0.7)"
  const v1Font = `bold ${Math.max(12, scale * 0.16)}px monospace`
  const v1Color = "rgba(0, 210, 160, 0.9)"
  const detailFont = `${Math.max(9, scale * 0.1)}px monospace`
  const detailColor = "rgba(0, 210, 160, 0.65)"
  const arrowLobe = "rgba(140, 160, 185, 0.35)"
  const arrowV1 = "rgba(0, 210, 160, 0.45)"

  // --- FRONTAL label (far left, outside brain) ---
  const frontalLabelX = -2.5 * scaleX
  const frontalLabelY = -0.85 * scaleY
  const frontalTargetX = -1.2 * scaleX
  const frontalTargetY = -0.7 * scaleY
  ctx.font = lobeFont
  ctx.fillStyle = lobeColor
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  ctx.fillText("FRONTAL", frontalLabelX, frontalLabelY)
  drawArrow(ctx, frontalLabelX + 8, frontalLabelY, frontalTargetX, frontalTargetY, arrowLobe)

  // --- PARIETAL label (top, above brain) ---
  const parietalLabelX = 0.1 * scaleX
  const parietalLabelY = -2.0 * scaleY
  const parietalTargetX = 0.1 * scaleX
  const parietalTargetY = -1.45 * scaleY
  ctx.font = lobeFont
  ctx.fillStyle = lobeColor
  ctx.textAlign = "center"
  ctx.fillText("PARIETAL", parietalLabelX, parietalLabelY)
  drawArrow(ctx, parietalLabelX, parietalLabelY + 8, parietalTargetX, parietalTargetY, arrowLobe)

  // --- TEMPORAL label (below brain) ---
  const temporalLabelX = -0.5 * scaleX
  const temporalLabelY = 1.35 * scaleY
  const temporalTargetX = -0.5 * scaleX
  const temporalTargetY = 0.8 * scaleY
  ctx.font = lobeFont
  ctx.fillStyle = lobeColor
  ctx.textAlign = "center"
  ctx.fillText("TEMPORAL", temporalLabelX, temporalLabelY)
  drawArrow(ctx, temporalLabelX, temporalLabelY - 8, temporalTargetX, temporalTargetY, arrowLobe)

  // --- V1 label (far right, outside brain) ---
  const v1LabelX = 2.45 * scaleX
  const v1LabelY = 0.0 * scaleY
  const v1TargetX = 1.5 * scaleX
  const v1TargetY = 0.0 * scaleY
  ctx.font = v1Font
  ctx.fillStyle = v1Color
  ctx.textAlign = "left"
  ctx.fillText("V1", v1LabelX, v1LabelY)
  drawArrow(ctx, v1LabelX - 4, v1LabelY, v1TargetX, v1TargetY, arrowV1)

  // --- Dorsal label (upper right, outside) ---
  const dorsalLabelX = 2.45 * scaleX
  const dorsalLabelY = -0.7 * scaleY
  const dorsalTargetX = 1.3 * scaleX
  const dorsalTargetY = -0.5 * scaleY
  ctx.font = detailFont
  ctx.fillStyle = detailColor
  ctx.textAlign = "left"
  ctx.fillText("dorsal", dorsalLabelX, dorsalLabelY)
  ctx.font = `${Math.max(8, scale * 0.08)}px monospace`
  ctx.fillStyle = "rgba(0, 210, 160, 0.4)"
  ctx.fillText("(lower visual field)", dorsalLabelX, dorsalLabelY + scale * 0.14)
  drawArrow(ctx, dorsalLabelX - 4, dorsalLabelY, dorsalTargetX, dorsalTargetY, arrowV1)

  // --- Ventral label (lower right, outside) ---
  const ventralLabelX = 2.45 * scaleX
  const ventralLabelY = 0.7 * scaleY
  const ventralTargetX = 1.3 * scaleX
  const ventralTargetY = 0.5 * scaleY
  ctx.font = detailFont
  ctx.fillStyle = detailColor
  ctx.textAlign = "left"
  ctx.fillText("ventral", ventralLabelX, ventralLabelY)
  ctx.font = `${Math.max(8, scale * 0.08)}px monospace`
  ctx.fillStyle = "rgba(0, 210, 160, 0.4)"
  ctx.fillText("(upper visual field)", ventralLabelX, ventralLabelY + scale * 0.14)
  drawArrow(ctx, ventralLabelX - 4, ventralLabelY, ventralTargetX, ventralTargetY, arrowV1)

  // --- Fovea label (far right, near posterior pole) ---
  const foveaLabelX = 2.45 * scaleX
  const foveaLabelY = -0.25 * scaleY
  const foveaTargetX = 1.82 * scaleX
  const foveaTargetY = 0.0 * scaleY
  ctx.font = detailFont
  ctx.fillStyle = detailColor
  ctx.textAlign = "left"
  ctx.fillText("fovea", foveaLabelX, foveaLabelY)
  drawArrow(ctx, foveaLabelX - 4, foveaLabelY, foveaTargetX, foveaTargetY, arrowV1)

  // Fovea dot on the brain
  ctx.beginPath()
  ctx.arc(1.82 * scaleX, 0.0 * scaleY, 4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(1.82 * scaleX, 0.0 * scaleY, 7, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  // --- Periphery label (left side of V1) ---
  const periphLabelX = -0.1 * scaleX
  const periphLabelY = 0.0 * scaleY
  const periphTargetX = 0.65 * scaleX
  const periphTargetY = -0.02 * scaleY
  ctx.font = detailFont
  ctx.fillStyle = detailColor
  ctx.textAlign = "right"
  ctx.fillText("periphery", periphLabelX, periphLabelY)
  drawArrow(ctx, periphLabelX + 8, periphLabelY, periphTargetX, periphTargetY, arrowV1)

  ctx.restore()
}

export function OccipitalHeatmap({ matrix, gridRows, gridCols }: OccipitalHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const rotY = -0.15
  const rotX = 0
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    setPanX((prev) => prev + dx)
    setPanY((prev) => prev + dy)
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((prev) => Math.max(0.5, Math.min(3.0, prev - e.deltaY * 0.001)))
  }, [])

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastMouse.current.x
    const dy = e.touches[0].clientY - lastMouse.current.y
    setPanX((prev) => prev + dx)
    setPanY((prev) => prev + dy)
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height

    // Clear
    ctx.fillStyle = "#060810"
    ctx.fillRect(0, 0, width, height)

    const centerX = width * 0.48 + panX
    const centerY = height * 0.48 + panY
    const baseScale = Math.min(width, height) * 0.28 * zoom

    // Draw brain outline fill
    drawBrainOutline(ctx, centerX, centerY, baseScale, rotY, rotX)
    ctx.fillStyle = "rgba(18, 22, 36, 0.9)"
    ctx.fill()

    // Draw sulci
    drawSulci(ctx, centerX, centerY, baseScale, rotY, rotX)

    // Draw brain outline stroke
    drawBrainOutline(ctx, centerX, centerY, baseScale, rotY, rotX)
    ctx.strokeStyle = "rgba(80, 100, 130, 0.4)"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw V1 heatmap
    if (matrix.length > 0) {
      // Clip to V1 region
      drawOccipitalRegion(ctx, centerX, centerY, baseScale, rotY, rotX)
      ctx.save()
      ctx.clip()

      const bounds = getV1Bounds(centerX, centerY, baseScale, rotY, rotX)
      const halfRows = gridRows / 2
      const halfCols = gridCols / 2

      // Render heatmap pixels within the V1 region
      const pixelSize = 3
      for (let py = bounds.top; py < bounds.bottom; py += pixelSize) {
        for (let px = bounds.left; px < bounds.right; px += pixelSize) {
          // Map pixel position to V1 retinotopic coordinates
          const u = (px - bounds.left) / (bounds.right - bounds.left)
          const v = (py - bounds.top) / (bounds.bottom - bounds.top)

          // Log-polar: u maps anterior->posterior (periphery->fovea)
          const logScale = 0.4
          const eccentricity =
            (Math.exp((1 - u) / logScale) - 1) / (Math.exp(1 / logScale) - 1)
          const maxEcc = Math.sqrt(halfRows * halfRows + halfCols * halfCols)
          const ecc = eccentricity * maxEcc

          // v maps dorsal->ventral (lower->upper visual field)
          const angle = (v - 0.5) * Math.PI * 0.85

          const visualX = ecc * Math.cos(angle)
          const visualY = ecc * Math.sin(angle)

          const gCol = Math.floor(halfCols + visualX)
          const gRow = Math.floor(halfRows - visualY)

          if (
            gRow >= 0 &&
            gRow < gridRows &&
            gCol >= 0 &&
            gCol < gridCols &&
            matrix[gRow] &&
            matrix[gRow][gCol] !== undefined
          ) {
            const value = matrix[gRow][gCol]
            const normalized = (value - 2) / 75
            const [r, g, b] = heatColor(normalized)
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
            ctx.fillRect(px, py, pixelSize, pixelSize)
          }
        }
      }

      ctx.restore()
    }

    // Draw V1 region border
    drawOccipitalRegion(ctx, centerX, centerY, baseScale, rotY, rotX)
    ctx.strokeStyle = "rgba(0, 210, 160, 0.5)"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw V1 glow border
    drawOccipitalRegion(ctx, centerX, centerY, baseScale, rotY, rotX)
    ctx.strokeStyle = "rgba(0, 210, 160, 0.12)"
    ctx.lineWidth = 6
    ctx.stroke()

    // Draw calcarine sulcus
    drawCalcarine(ctx, centerX, centerY, baseScale, rotY, rotX)

    // Draw labels
    drawLabels(ctx, centerX, centerY, baseScale, rotY, rotX)
  }, [matrix, gridRows, gridCols, rotY, rotX, zoom, panX, panY])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Occipital Cortex Map
        </h2>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810]">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          drag to move / scroll to zoom
        </div>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="text-[10px]">low stimulus</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(8, 12, 60)" }} />
          <div className="flex-1" style={{ background: "rgb(15, 60, 110)" }} />
          <div className="flex-1" style={{ background: "rgb(20, 180, 170)" }} />
          <div className="flex-1" style={{ background: "rgb(160, 230, 50)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 180, 30)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 245, 220)" }} />
        </div>
        <span className="text-[10px]">high stimulus</span>
      </div>
    </div>
  )
}
