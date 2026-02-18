"use client"

import { useRef, useEffect } from "react"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridSize: number
}

/**
 * Retinotopic mapping: the visual field maps onto V1 (primary visual cortex)
 * in the occipital lobe via a log-polar transform.
 *
 * - Central vision (fovea) maps to the posterior pole of the occipital lobe
 * - Peripheral vision maps more anteriorly
 * - Upper visual field maps to the lower bank of the calcarine sulcus (ventral)
 * - Lower visual field maps to the upper bank (dorsal)
 * - Left visual field maps to right hemisphere, right to left
 *
 * We use a simplified log-polar mapping:
 *   cortical_r = k * ln(1 + eccentricity)
 *   cortical_theta = polar_angle
 * where eccentricity = distance from center of visual field
 */

function heatColor(normalized: number): [number, number, number] {
  // Blue (cold/dark) -> Cyan -> Green -> Yellow -> Red -> White (hot/bright)
  const t = Math.max(0, Math.min(1, normalized))

  let r: number, g: number, b: number

  if (t < 0.2) {
    // Deep blue to blue
    const s = t / 0.2
    r = 10
    g = 10 + s * 40
    b = 60 + s * 140
  } else if (t < 0.4) {
    // Blue to cyan
    const s = (t - 0.2) / 0.2
    r = 10
    g = 50 + s * 180
    b = 200 - s * 30
  } else if (t < 0.6) {
    // Cyan to green/yellow
    const s = (t - 0.4) / 0.2
    r = 10 + s * 200
    g = 230 - s * 20
    b = 170 - s * 150
  } else if (t < 0.8) {
    // Yellow to orange/red
    const s = (t - 0.6) / 0.2
    r = 210 + s * 45
    g = 210 - s * 140
    b = 20 - s * 10
  } else {
    // Red to white-hot
    const s = (t - 0.8) / 0.2
    r = 255
    g = 70 + s * 185
    b = 10 + s * 200
  }

  return [Math.round(r), Math.round(g), Math.round(b)]
}

export function OccipitalHeatmap({ matrix, gridSize }: OccipitalHeatmapProps) {
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

    // Dark background
    ctx.fillStyle = "#080a0f"
    ctx.fillRect(0, 0, width, height)

    // Draw the occipital lobe outline
    const cx = width / 2
    const cy = height * 0.48

    // Main brain outline (medial view of occipital lobe)
    const lobeW = width * 0.42
    const lobeH = height * 0.42

    // Draw lobe shape path
    ctx.save()
    ctx.beginPath()

    // Create an elliptical occipital lobe shape
    // The occipital lobe is roughly wedge/fan shaped at the posterior of the brain
    const lobePoints: [number, number][] = []
    const segments = 80
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      // Vary radius to create a more organic brain-like shape
      let rx = lobeW
      let ry = lobeH

      // Make it more pointed at the back (posterior = left side of our view)
      // and wider at the front (anterior = right)
      const angleFactor = Math.cos(angle)
      const vertFactor = Math.sin(angle)

      // Organic variation
      rx *= 1 + 0.12 * Math.cos(angle * 2) - 0.08 * Math.cos(angle * 3)
      ry *= 1 + 0.08 * Math.sin(angle * 2) + 0.05 * Math.cos(angle * 4)

      // Flatten the top slightly and make bottom rounder (cerebellum region)
      if (vertFactor < 0) {
        ry *= 0.9
      }

      // Indent for the calcarine sulcus (horizontal fissure through the middle)
      const calcIndent = Math.exp(-Math.pow(vertFactor, 2) * 8) * 0.06
      rx *= 1 - calcIndent * Math.abs(angleFactor)

      const x = cx + rx * Math.cos(angle)
      const y = cy + ry * Math.sin(angle)
      lobePoints.push([x, y])
    }

    // Draw the lobe path
    ctx.moveTo(lobePoints[0][0], lobePoints[0][1])
    for (let i = 1; i < lobePoints.length; i++) {
      ctx.lineTo(lobePoints[i][0], lobePoints[i][1])
    }
    ctx.closePath()
    ctx.clip()

    // Now paint the heatmap inside the clipped lobe region
    // Retinotopic mapping: convert each matrix cell to a cortical position

    const halfGrid = gridSize / 2
    // k controls how much cortical space foveal (center) gets vs peripheral
    const kScale = Math.min(lobeW, lobeH) * 0.65
    const maxEcc = Math.sqrt(2) * halfGrid

    // We need to build a pixel buffer for smooth heatmap
    // Sample every pixel in the lobe and find which matrix cell it maps to
    const imgData = ctx.createImageData(Math.ceil(width), Math.ceil(height))
    const pixels = imgData.data

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // Convert pixel to cortical coordinates relative to center
        const dx = px - cx
        const dy = py - cy

        // Check if inside lobe bounds (rough ellipse check)
        const normX = dx / lobeW
        const normY = dy / lobeH
        const distFromCenter = Math.sqrt(normX * normX + normY * normY)
        if (distFromCenter > 1.15) continue

        // Inverse retinotopic map: cortical position -> visual field position
        // cortical distance from posterior pole (center of lobe)
        const corticalDist = Math.sqrt(dx * dx + dy * dy)
        const corticalAngle = Math.atan2(dy, dx)

        // Inverse log-polar: eccentricity = exp(corticalDist / k) - 1
        const eccentricity = Math.exp(corticalDist / kScale) - 1

        if (eccentricity > maxEcc) continue

        // Convert polar visual field coordinates to grid coordinates
        // Upper visual field -> lower calcarine (positive dy -> negative visual y)
        // Left visual field -> right hemisphere (positive dx -> negative visual x)
        const visualX = eccentricity * Math.cos(corticalAngle)
        const visualY = eccentricity * Math.sin(corticalAngle)

        // Map to grid indices
        const gridCol = Math.floor(halfGrid + visualX)
        const gridRow = Math.floor(halfGrid + visualY)

        if (
          gridRow < 0 ||
          gridRow >= gridSize ||
          gridCol < 0 ||
          gridCol >= gridSize
        )
          continue
        if (!matrix[gridRow] || matrix[gridRow][gridCol] === undefined) continue

        const value = matrix[gridRow][gridCol]
        const normalized = (value - 2) / 75

        const [r, g, b] = heatColor(normalized)
        const idx = (py * Math.ceil(width) + px) * 4
        pixels[idx] = r
        pixels[idx + 1] = g
        pixels[idx + 2] = b
        pixels[idx + 3] = 220
      }
    }

    ctx.putImageData(imgData, 0, 0)
    ctx.restore()

    // Re-draw the lobe outline on top
    ctx.beginPath()
    ctx.moveTo(lobePoints[0][0], lobePoints[0][1])
    for (let i = 1; i < lobePoints.length; i++) {
      ctx.lineTo(lobePoints[i][0], lobePoints[i][1])
    }
    ctx.closePath()
    ctx.strokeStyle = "rgba(0, 210, 160, 0.5)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Draw calcarine sulcus (horizontal line through middle)
    ctx.beginPath()
    ctx.moveTo(cx - lobeW * 0.95, cy)
    ctx.bezierCurveTo(
      cx - lobeW * 0.5,
      cy - 2,
      cx + lobeW * 0.3,
      cy + 2,
      cx + lobeW * 0.7,
      cy
    )
    ctx.strokeStyle = "rgba(0, 210, 160, 0.35)"
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // Labels
    ctx.font = "10px 'Geist Mono', monospace"
    ctx.fillStyle = "rgba(0, 210, 160, 0.6)"

    // Posterior label (foveal/central vision)
    ctx.textAlign = "center"
    ctx.fillText("POSTERIOR", cx, cy + lobeH + 20)
    ctx.fillText("(foveal)", cx, cy + lobeH + 32)

    // Dorsal / Ventral
    ctx.save()
    ctx.translate(cx - lobeW - 16, cy)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillText("DORSAL", 0, 0)
    ctx.restore()

    ctx.save()
    ctx.translate(cx + lobeW + 16, cy)
    ctx.rotate(Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillText("VENTRAL", 0, 0)
    ctx.restore()

    // Draw a small fovea marker at center
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
    ctx.fill()
    ctx.font = "9px 'Geist Mono', monospace"
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.textAlign = "left"
    ctx.fillText("V1", cx + 6, cy + 3)
  }, [matrix, gridSize])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Occipital Cortex Map
        </h2>
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#080a0f]">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{ imageRendering: "auto" }}
        />
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="text-[10px]">cold</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(10, 30, 120)" }} />
          <div className="flex-1" style={{ background: "rgb(10, 180, 180)" }} />
          <div className="flex-1" style={{ background: "rgb(160, 220, 40)" }} />
          <div className="flex-1" style={{ background: "rgb(240, 140, 10)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 200, 160)" }} />
        </div>
        <span className="text-[10px]">hot</span>
      </div>
    </div>
  )
}
