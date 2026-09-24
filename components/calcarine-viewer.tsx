"use client"

import { useRef, useEffect } from "react"
import { LearnMore } from "./learn-more"
import { fromDisplayIntensity } from "@/lib/phosphene"
import {
  gridCellToVisualField,
  visualFieldToCortex,
  corticalMagnification,
  DEFAULT_MAX_ECCENTRICITY_DEG,
} from "@/lib/retinotopy"

interface CalcarineViewerProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

// Cold blue -> cyan -> green -> yellow -> white. Returns float RGB in [0, 1].
function heatColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  if (v < 0.2) {
    const f = v / 0.2
    return [0.03 + f * 0.03, 0.05 + f * 0.19, 0.24 + f * 0.19]
  }
  if (v < 0.4) {
    const f = (v - 0.2) / 0.2
    return [0.06 + f * 0.02, 0.24 + f * 0.47, 0.43 + f * 0.24]
  }
  if (v < 0.6) {
    const f = (v - 0.4) / 0.2
    return [0.08 + f * 0.55, 0.71 + f * 0.19, 0.67 - f * 0.47]
  }
  if (v < 0.8) {
    const f = (v - 0.6) / 0.2
    return [0.63 + f * 0.37, 0.9 - f * 0.19, 0.2 - f * 0.08]
  }
  const f = (v - 0.8) / 0.2
  return [1.0, 0.71 + f * 0.25, 0.12 + f * 0.74]
}

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

/**
 * Schematic V1 retinotopic map.
 *
 * This is a forward projection of every camera grid cell onto a per-hemisphere
 * flatmap using lib/retinotopy (Horton & Hoyt, 1991 cortical magnification;
 * Schwartz, 1977 log-polar structure). It is a CONCEPTUAL schematic: the two
 * flattened hemispheres are drawn side by side with their foveal
 * representations (occipital poles) meeting at the center. It does NOT
 * reproduce any individual's folded cortical anatomy.
 */
export function CalcarineViewer({ matrix, gridRows, gridCols }: CalcarineViewerProps) {
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const W = rect.width
    const H = rect.height

    // Background
    ctx.fillStyle = "#0a0c14"
    ctx.fillRect(0, 0, W, H)

    // Panel geometry: two hemisphere flatmaps side by side.
    const topPad = 34
    const botPad = 26
    const sidePad = 12
    const midGap = 26
    const panelW = (W - sidePad * 2 - midGap) / 2
    const yTop = topPad
    const yBot = H - botPad
    const panelH = yBot - yTop

    // Left hemisphere panel (left of canvas), fovea at its INNER (right) edge.
    const leftX0 = sidePad // outer = periphery
    const leftX1 = sidePad + panelW // inner = fovea
    // Right hemisphere panel (right of canvas), fovea at its INNER (left) edge.
    const rightX0 = sidePad + panelW + midGap // inner = fovea
    const rightX1 = W - sidePad // outer = periphery

    const M0 = corticalMagnification(0)

    // ---- Panel frames + guides ----
    const drawPanelGuides = (x0: number, x1: number, hemi: "left" | "right") => {
      const left = Math.min(x0, x1)
      // Frame
      ctx.strokeStyle = "rgba(80, 100, 130, 0.35)"
      ctx.lineWidth = 1
      ctx.strokeRect(left, yTop, panelW, panelH)

      // Calcarine fissure = horizontal meridian, at flatY 0.5
      const midY = yTop + panelH * 0.5
      ctx.strokeStyle = "rgba(0, 210, 160, 0.55)"
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(left, midY)
      ctx.lineTo(left + panelW, midY)
      ctx.stroke()
      ctx.setLineDash([])

      // Fovea marker at the inner edge (occipital pole)
      const foveaX = hemi === "left" ? x1 : x0
      ctx.beginPath()
      ctx.arc(foveaX, midY, 3, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.fill()
    }

    drawPanelGuides(leftX0, leftX1, "left")
    drawPanelGuides(rightX0, rightX1, "right")

    // ---- Plot each grid cell at its cortical location ----
    const hasData = matrix.length > 0
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const vf = gridCellToVisualField(row, col, gridRows, gridCols, DEFAULT_MAX_ECCENTRICITY_DEG)
        const cortex = visualFieldToCortex(vf, DEFAULT_MAX_ECCENTRICITY_DEG)

        let sx: number
        if (cortex.hemisphere === "left") {
          sx = leftX1 - cortex.flatX * (leftX1 - leftX0) // fovea inner -> periphery outer
        } else {
          sx = rightX0 + cortex.flatX * (rightX1 - rightX0)
        }
        const sy = yTop + cortex.flatY * panelH

        // Dot radius reflects cortical magnification: foveal cells occupy more
        // cortical area, so draw them larger (illustrative but derived from M(E)).
        const magRatio = corticalMagnification(vf.eccentricityDeg) / M0
        const baseR = Math.max(1.2, Math.min(panelW, panelH) / Math.max(gridRows, gridCols) * 0.5)
        const radius = baseR * (0.55 + 0.9 * magRatio)

        let color: [number, number, number]
        if (hasData && matrix[row]?.[col] !== undefined) {
          color = heatColor(fromDisplayIntensity(matrix[row][col]))
        } else {
          color = [0.08, 0.12, 0.22]
        }

        ctx.beginPath()
        ctx.arc(sx, sy, radius, 0, Math.PI * 2)
        ctx.fillStyle = rgb(color)
        ctx.fill()
      }
    }

    // ---- Labels ----
    ctx.textBaseline = "middle"

    // Hemisphere headers
    ctx.font = "bold 11px monospace"
    ctx.fillStyle = "rgba(0, 210, 160, 0.9)"
    ctx.textAlign = "center"
    ctx.fillText("LEFT V1", sidePad + panelW / 2, 12)
    ctx.fillText("RIGHT V1", rightX0 + panelW / 2, 12)

    ctx.font = "9px monospace"
    ctx.fillStyle = "rgba(140, 160, 185, 0.75)"
    ctx.fillText("(right visual field)", sidePad + panelW / 2, 24)
    ctx.fillText("(left visual field)", rightX0 + panelW / 2, 24)

    // Dorsal / ventral (shared vertical labels, drawn per panel edge)
    ctx.font = "8px monospace"
    ctx.fillStyle = "rgba(140, 160, 185, 0.6)"
    ctx.textAlign = "left"
    ctx.fillText("dorsal / lower field", sidePad + 3, yTop + 8)
    ctx.fillText("ventral / upper field", sidePad + 3, yBot - 8)

    // Fovea / periphery cues on the midline
    ctx.fillStyle = "rgba(200, 210, 225, 0.6)"
    ctx.textAlign = "center"
    ctx.fillText("fovea", leftX1, yBot + 14)
    ctx.fillText("fovea", rightX0, yBot + 14)
    ctx.textAlign = "left"
    ctx.fillText("periphery", leftX0, yBot + 14)
    ctx.textAlign = "right"
    ctx.fillText("periphery", rightX1, yBot + 14)
  }, [matrix, gridRows, gridCols])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          V1 Retinotopic Map
        </h2>
        <span className="ml-auto rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          schematic
        </span>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#0a0c14]">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="text-[10px]">low</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(8, 12, 60)" }} />
          <div className="flex-1" style={{ background: "rgb(15, 60, 110)" }} />
          <div className="flex-1" style={{ background: "rgb(20, 180, 170)" }} />
          <div className="flex-1" style={{ background: "rgb(160, 230, 50)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 180, 30)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 245, 220)" }} />
        </div>
        <span className="text-[10px]">high</span>
      </div>
      <LearnMore>
        <p className="mb-1.5">
          <span className="text-primary">Schematic model.</span> Each camera cell is
          projected onto a flattened map of primary visual cortex (V1) using three
          established principles. Dot color shows the cell&apos;s stimulation intensity;
          dot size grows toward the fovea to reflect cortical magnification.
        </p>
        <p className="mb-1.5">
          <span className="text-primary">Contralateral organization:</span> the left
          visual field is represented in the right hemisphere and vice versa
          (Holmes, 1918; Horton &amp; Hoyt, 1991).
        </p>
        <p className="mb-1.5">
          <span className="text-primary">Dorsal/ventral split:</span> the calcarine
          sulcus (dashed line) separates the map. The upper visual field maps to the
          ventral bank and the lower visual field to the dorsal bank.
        </p>
        <p className="mb-1.5">
          <span className="text-primary">Cortical magnification:</span> central vision
          occupies far more cortex per degree than the periphery. We use the human
          magnification function M(E) = 17.3 / (E + 0.75) mm/deg, so cortical distance
          from the occipital pole is d(E) = 17.3 &middot; ln(1 + E/0.75) mm
          (Horton &amp; Hoyt, 1991; log-polar structure from Schwartz, 1977).
        </p>
        <p>
          <span className="text-primary">Limitation:</span> this is a 2D conceptual
          schematic, not a reconstruction of folded anatomy. The two hemispheres are
          drawn side by side with their foveal representations meeting at the center;
          real V1 lies on the medial walls of both occipital lobes. Parameters are
          population averages and the assumed field of view is a simulation choice.
        </p>
      </LearnMore>
    </div>
  )
}
