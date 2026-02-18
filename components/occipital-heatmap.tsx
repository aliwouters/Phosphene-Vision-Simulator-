"use client"

import { useRef, useEffect } from "react"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridSize: number
}

/**
 * Simplified retinotopic map:
 * - The occipital lobe is drawn as a medial-view brain section
 * - V1 sits along the calcarine sulcus
 * - Center of visual field (fovea) -> posterior pole (back of brain)
 * - Peripheral vision -> anterior (deeper into sulcus)
 * - Upper visual field -> ventral bank (below calcarine)
 * - Lower visual field -> dorsal bank (above calcarine)
 */

function heatColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  // Dark blue -> Cyan -> Yellow -> Orange -> White
  if (v < 0.15) {
    const s = v / 0.15
    return [Math.round(8 + s * 5), Math.round(8 + s * 20), Math.round(40 + s * 80)]
  }
  if (v < 0.35) {
    const s = (v - 0.15) / 0.2
    return [Math.round(13), Math.round(28 + s * 180), Math.round(120 + s * 80)]
  }
  if (v < 0.55) {
    const s = (v - 0.35) / 0.2
    return [Math.round(13 + s * 220), Math.round(208 + s * 42), Math.round(200 - s * 150)]
  }
  if (v < 0.75) {
    const s = (v - 0.55) / 0.2
    return [Math.round(233 + s * 22), Math.round(250 - s * 100), Math.round(50 - s * 30)]
  }
  if (v < 0.9) {
    const s = (v - 0.75) / 0.15
    return [255, Math.round(150 - s * 60), Math.round(20 + s * 20)]
  }
  const s = (v - 0.9) / 0.1
  return [255, Math.round(90 + s * 165), Math.round(40 + s * 215)]
}

export function OccipitalHeatmap({ matrix, gridSize }: OccipitalHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const W = rect.width
    const H = rect.height

    // Clear
    ctx.fillStyle = "#080a0f"
    ctx.fillRect(0, 0, W, H)

    // --- Draw brain outline (medial sagittal view, left hemisphere) ---
    // Brain occupies top ~75% of canvas, centered horizontally
    const brainCx = W * 0.48
    const brainCy = H * 0.42
    const brainW = W * 0.44
    const brainH = H * 0.36

    // Full brain silhouette using bezier curves (medial view)
    ctx.save()

    // --- Build brain outline path ---
    function brainPath() {
      ctx.beginPath()
      // Start at frontal pole (left)
      const fx = brainCx - brainW * 0.95
      const fy = brainCy - brainH * 0.05

      ctx.moveTo(fx, fy)

      // Frontal lobe top curve
      ctx.bezierCurveTo(
        brainCx - brainW * 0.85, brainCy - brainH * 0.9,
        brainCx - brainW * 0.4, brainCy - brainH * 1.05,
        brainCx, brainCy - brainH * 0.95
      )

      // Parietal lobe curve
      ctx.bezierCurveTo(
        brainCx + brainW * 0.35, brainCy - brainH * 0.85,
        brainCx + brainW * 0.7, brainCy - brainH * 0.7,
        brainCx + brainW * 0.9, brainCy - brainH * 0.35
      )

      // Occipital pole (posterior - rightmost point)
      ctx.bezierCurveTo(
        brainCx + brainW * 1.0, brainCy - brainH * 0.1,
        brainCx + brainW * 1.0, brainCy + brainH * 0.1,
        brainCx + brainW * 0.9, brainCy + brainH * 0.3
      )

      // Below occipital, cerebellum notch
      ctx.bezierCurveTo(
        brainCx + brainW * 0.75, brainCy + brainH * 0.55,
        brainCx + brainW * 0.5, brainCy + brainH * 0.65,
        brainCx + brainW * 0.3, brainCy + brainH * 0.6
      )

      // Temporal lobe / brain stem
      ctx.bezierCurveTo(
        brainCx - brainW * 0.1, brainCy + brainH * 0.55,
        brainCx - brainW * 0.5, brainCy + brainH * 0.6,
        brainCx - brainW * 0.7, brainCy + brainH * 0.45
      )

      // Back up to frontal pole
      ctx.bezierCurveTo(
        brainCx - brainW * 0.85, brainCy + brainH * 0.35,
        brainCx - brainW * 0.95, brainCy + brainH * 0.15,
        fx, fy
      )

      ctx.closePath()
    }

    // Fill brain silhouette with dark gray
    brainPath()
    ctx.fillStyle = "#111520"
    ctx.fill()

    // --- Define occipital lobe region for the heatmap ---
    // Occipital lobe = posterior portion of the brain around calcarine sulcus
    const occCx = brainCx + brainW * 0.65  // Center of occipital region
    const occCy = brainCy - brainH * 0.02
    const occRadiusX = brainW * 0.38
    const occRadiusY = brainH * 0.55

    function occipitalPath() {
      ctx.beginPath()
      // Wedge shape representing V1 area along calcarine
      // Top (dorsal bank)
      ctx.moveTo(occCx - occRadiusX * 0.15, occCy - occRadiusY * 0.05)

      ctx.bezierCurveTo(
        occCx + occRadiusX * 0.1, occCy - occRadiusY * 0.7,
        occCx + occRadiusX * 0.5, occCy - occRadiusY * 0.8,
        occCx + occRadiusX * 0.85, occCy - occRadiusY * 0.35
      )

      // Posterior pole (tip)
      ctx.bezierCurveTo(
        occCx + occRadiusX * 1.0, occCy - occRadiusY * 0.1,
        occCx + occRadiusX * 1.0, occCy + occRadiusY * 0.1,
        occCx + occRadiusX * 0.85, occCy + occRadiusY * 0.35
      )

      // Bottom (ventral bank)
      ctx.bezierCurveTo(
        occCx + occRadiusX * 0.5, occCy + occRadiusY * 0.75,
        occCx + occRadiusX * 0.1, occCy + occRadiusY * 0.65,
        occCx - occRadiusX * 0.15, occCy + occRadiusY * 0.05
      )

      ctx.closePath()
    }

    // Clip to both the brain shape AND the occipital region
    // First clip to brain
    brainPath()
    ctx.clip()

    // Now clip to occipital lobe
    occipitalPath()
    ctx.clip()

    // --- Paint the heatmap inside the clipped occipital region ---
    if (matrix.length > 0) {
      const halfGrid = gridSize / 2
      const posteriorX = occCx + occRadiusX * 0.85  // Posterior pole = fovea
      const anteriorX = occCx - occRadiusX * 0.15    // Anterior boundary = periphery
      const corticalSpanX = posteriorX - anteriorX
      const corticalSpanY = occRadiusY * 0.7

      // Build image data for smooth mapping
      const imgData = ctx.createImageData(Math.ceil(W), Math.ceil(H))
      const pixels = imgData.data

      for (let py = Math.floor(occCy - occRadiusY); py < Math.ceil(occCy + occRadiusY); py++) {
        for (let px = Math.floor(anteriorX - 10); px < Math.ceil(posteriorX + 10); px++) {
          if (px < 0 || px >= W || py < 0 || py >= H) continue

          const dx = px - posteriorX
          const dy = py - occCy

          // Distance from posterior pole (logarithmic for cortical magnification)
          const distFromPosterior = Math.sqrt(dx * dx + dy * dy)
          const maxDist = corticalSpanX

          if (distFromPosterior > maxDist * 1.1) continue

          // Eccentricity: log-polar inverse mapping
          // Posterior pole (close) = fovea (center of visual field)
          // Anterior (far) = periphery
          const logScale = corticalSpanX * 0.45
          const eccentricity = Math.exp(distFromPosterior / logScale) - 1
          const maxEcc = Math.sqrt(2) * halfGrid

          if (eccentricity > maxEcc * 1.2) continue

          // Angle from posterior pole determines upper/lower visual field
          const corticalAngle = Math.atan2(dy, -dx) // negative dx because posterior is right

          // Map to visual field: upper cortex (dorsal, dy<0) -> lower visual field
          // lower cortex (ventral, dy>0) -> upper visual field
          const visualAngle = corticalAngle

          const visualX = eccentricity * Math.cos(visualAngle)
          const visualY = eccentricity * Math.sin(visualAngle)

          const gridCol = Math.floor(halfGrid + visualX)
          const gridRow = Math.floor(halfGrid + visualY)

          if (gridRow < 0 || gridRow >= gridSize || gridCol < 0 || gridCol >= gridSize) continue
          if (!matrix[gridRow] || matrix[gridRow][gridCol] === undefined) continue

          const value = matrix[gridRow][gridCol]
          const normalized = (value - 2) / 75

          const [r, g, b] = heatColor(normalized)
          const idx = (py * Math.ceil(W) + px) * 4
          pixels[idx] = r
          pixels[idx + 1] = g
          pixels[idx + 2] = b
          pixels[idx + 3] = 210
        }
      }

      ctx.putImageData(imgData, 0, 0)
    } else {
      // No data -- fill occipital with dim blue
      occipitalPath()
      ctx.fillStyle = "rgba(15, 25, 60, 0.5)"
      ctx.fill()
    }

    ctx.restore()

    // --- Re-draw outlines on top ---

    // Full brain outline
    brainPath()
    ctx.strokeStyle = "rgba(100, 120, 140, 0.4)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Occipital lobe outline (highlighted)
    occipitalPath()
    ctx.strokeStyle = "rgba(0, 210, 160, 0.6)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Calcarine sulcus (dashed line through middle of V1)
    ctx.beginPath()
    ctx.moveTo(occCx - occRadiusX * 0.1, occCy)
    ctx.bezierCurveTo(
      occCx + occRadiusX * 0.2, occCy - 1,
      occCx + occRadiusX * 0.6, occCy + 1,
      occCx + occRadiusX * 0.85, occCy
    )
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // --- Labels ---
    ctx.font = `${Math.max(9, W * 0.025)}px 'Geist Mono', monospace`
    ctx.textAlign = "center"

    // Brain region labels
    ctx.fillStyle = "rgba(100, 120, 140, 0.5)"
    ctx.fillText("FRONTAL", brainCx - brainW * 0.55, brainCy - brainH * 0.4)
    ctx.fillText("PARIETAL", brainCx + brainW * 0.15, brainCy - brainH * 0.65)
    ctx.fillText("TEMPORAL", brainCx - brainW * 0.2, brainCy + brainH * 0.48)

    // Occipital label (prominent)
    ctx.fillStyle = "rgba(0, 210, 160, 0.7)"
    ctx.font = `bold ${Math.max(10, W * 0.028)}px 'Geist Mono', monospace`
    ctx.fillText("V1", occCx + occRadiusX * 0.3, occCy + occRadiusY * 0.92)

    // Calcarine sulcus label
    ctx.font = `${Math.max(8, W * 0.02)}px 'Geist Mono', monospace`
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
    ctx.fillText("calcarine sulcus", occCx + occRadiusX * 0.35, occCy - 6)

    // Dorsal / Ventral labels
    ctx.fillStyle = "rgba(0, 210, 160, 0.45)"
    ctx.font = `${Math.max(8, W * 0.022)}px 'Geist Mono', monospace`
    ctx.fillText("DORSAL", occCx + occRadiusX * 0.4, occCy - occRadiusY * 0.5)
    ctx.fillText("(lower field)", occCx + occRadiusX * 0.4, occCy - occRadiusY * 0.5 + 12)
    ctx.fillText("VENTRAL", occCx + occRadiusX * 0.4, occCy + occRadiusY * 0.55)
    ctx.fillText("(upper field)", occCx + occRadiusX * 0.4, occCy + occRadiusY * 0.55 + 12)

    // Posterior / Anterior
    ctx.fillStyle = "rgba(0, 210, 160, 0.4)"
    ctx.textAlign = "right"
    ctx.fillText("POSTERIOR", occCx + occRadiusX * 0.95, occCy + occRadiusY * 0.9)
    ctx.fillText("(fovea)", occCx + occRadiusX * 0.95, occCy + occRadiusY * 0.9 + 11)
    ctx.textAlign = "left"
    ctx.fillText("ANT.", occCx - occRadiusX * 0.1, occCy + occRadiusY * 0.9)
    ctx.fillText("(periph.)", occCx - occRadiusX * 0.1, occCy + occRadiusY * 0.9 + 11)

    // Fovea marker at posterior pole
    const foveaX = occCx + occRadiusX * 0.85
    ctx.beginPath()
    ctx.arc(foveaX, occCy, 3, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(foveaX, occCy, 6, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = 0.5
    ctx.stroke()

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
        <span className="text-[10px]">low stimulus</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(8, 18, 80)" }} />
          <div className="flex-1" style={{ background: "rgb(13, 140, 170)" }} />
          <div className="flex-1" style={{ background: "rgb(180, 235, 60)" }} />
          <div className="flex-1" style={{ background: "rgb(250, 170, 25)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 230, 220)" }} />
        </div>
        <span className="text-[10px]">high stimulus</span>
      </div>
    </div>
  )
}
