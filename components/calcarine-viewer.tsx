"use client"

import { useRef, useEffect } from "react"
import { LearnMore } from "./learn-more"

interface CalcarineViewerProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

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
    return [0.63 + f * 0.37, 0.90 - f * 0.19, 0.20 - f * 0.08]
  }
  const f = (v - 0.8) / 0.2
  return [1.0, 0.71 + f * 0.25, 0.12 + f * 0.74]
}

// The visual field is divided into 4 quadrants x 3 eccentricity rings = 12 zones
// Quadrants: upper-left, upper-right, lower-left, lower-right
// Rings: foveal (center), parafoveal (mid), peripheral (outer)
//
// Zone numbering (matching Horton & Hoyt):
//   1: foveal upper-left       2: foveal upper-right
//   3: foveal lower-left       4: foveal lower-right
//   5: parafoveal upper-left   6: parafoveal upper-right
//   7: parafoveal lower-left   8: parafoveal lower-right
//   9: peripheral upper-left  10: peripheral upper-right
//  11: peripheral lower-left  12: peripheral lower-right
//
// Camera matrix: row 0 = top (upper VF), col 0 = camera-left
// Display is CSS-mirrored (selfie), so camera-left = user's right visual field
// Therefore: LOW col in matrix = RIGHT visual field, HIGH col = LEFT visual field

interface VFZone {
  id: number
  rowStart: number; rowEnd: number   // normalized camera rows (0=top, 1=bottom)
  colStart: number; colEnd: number   // normalized camera cols (0=camera-left=right VF, 1=camera-right=left VF)
  quadrant: "UL" | "UR" | "LL" | "LR"
  ring: "foveal" | "para" | "periph"
}

const ZONES: VFZone[] = [
  // Foveal (center 33%)
  { id: 1, rowStart: 0.33, rowEnd: 0.50, colStart: 0.50, colEnd: 0.67, quadrant: "UL", ring: "foveal" },
  { id: 2, rowStart: 0.33, rowEnd: 0.50, colStart: 0.33, colEnd: 0.50, quadrant: "UR", ring: "foveal" },
  { id: 3, rowStart: 0.50, rowEnd: 0.67, colStart: 0.50, colEnd: 0.67, quadrant: "LL", ring: "foveal" },
  { id: 4, rowStart: 0.50, rowEnd: 0.67, colStart: 0.33, colEnd: 0.50, quadrant: "LR", ring: "foveal" },
  // Parafoveal (mid ring)
  { id: 5, rowStart: 0.17, rowEnd: 0.33, colStart: 0.67, colEnd: 0.83, quadrant: "UL", ring: "para" },
  { id: 6, rowStart: 0.17, rowEnd: 0.33, colStart: 0.17, colEnd: 0.33, quadrant: "UR", ring: "para" },
  { id: 7, rowStart: 0.67, rowEnd: 0.83, colStart: 0.67, colEnd: 0.83, quadrant: "LL", ring: "para" },
  { id: 8, rowStart: 0.67, rowEnd: 0.83, colStart: 0.17, colEnd: 0.33, quadrant: "LR", ring: "para" },
  // Peripheral (outer ring)
  { id: 9,  rowStart: 0.0, rowEnd: 0.17, colStart: 0.83, colEnd: 1.0, quadrant: "UL", ring: "periph" },
  { id: 10, rowStart: 0.0, rowEnd: 0.17, colStart: 0.0,  colEnd: 0.17, quadrant: "UR", ring: "periph" },
  { id: 11, rowStart: 0.83, rowEnd: 1.0, colStart: 0.83, colEnd: 1.0, quadrant: "LL", ring: "periph" },
  { id: 12, rowStart: 0.83, rowEnd: 1.0, colStart: 0.0,  colEnd: 0.17, quadrant: "LR", ring: "periph" },
]

function getZoneAvg(matrix: number[][], zone: VFZone): number {
  const rows = matrix.length
  const cols = matrix[0]?.length || 0
  const r0 = Math.floor(zone.rowStart * rows)
  const r1 = Math.min(rows, Math.ceil(zone.rowEnd * rows))
  const c0 = Math.floor(zone.colStart * cols)
  const c1 = Math.min(cols, Math.ceil(zone.colEnd * cols))
  let sum = 0, count = 0
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (matrix[r]?.[c] !== undefined) { sum += matrix[r][c]; count++ }
    }
  }
  return count > 0 ? sum / count : 0
}

export function CalcarineViewer({ matrix }: CalcarineViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !matrix || matrix.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "#0a0c14"
    ctx.fillRect(0, 0, w, h)

    const midX = w / 2
    const midY = h * 0.48
    const hemiW = w * 0.38
    const hemiH = h * 0.40
    const gap = w * 0.025

    // Get zone averages
    const zoneAvg: Record<number, number> = {}
    for (const z of ZONES) { zoneAvg[z.id] = getZoneAvg(matrix, z) }

    // ---- Draw hemisphere outline (posterior view) ----
    function drawHemi(cx: number, isLeft: boolean) {
      const dir = isLeft ? -1 : 1
      ctx.save()
      ctx.beginPath()
      // Top of brain
      ctx.moveTo(cx, midY - hemiH)
      // Lateral curve
      ctx.bezierCurveTo(
        cx + dir * hemiW * 0.55, midY - hemiH * 1.05,
        cx + dir * hemiW * 1.05, midY - hemiH * 0.45,
        cx + dir * hemiW, midY * 0.98
      )
      // Lower lateral
      ctx.bezierCurveTo(
        cx + dir * hemiW * 0.95, midY + hemiH * 0.55,
        cx + dir * hemiW * 0.55, midY + hemiH * 1.02,
        cx, midY + hemiH
      )
      // Medial (straight)
      ctx.lineTo(cx, midY - hemiH)
      ctx.closePath()
      ctx.fillStyle = "rgba(255,255,255,0.025)"
      ctx.fill()
      ctx.strokeStyle = "rgba(255,255,255,0.18)"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()

      // Sulcus detail lines
      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.06)"
      ctx.lineWidth = 0.7
      for (let i = 0; i < 4; i++) {
        const yBase = midY - hemiH * 0.7 + i * hemiH * 0.25
        const wobble = (i % 2 === 0 ? 1 : -1) * hemiH * 0.03
        ctx.beginPath()
        ctx.moveTo(cx + dir * hemiW * 0.08, yBase)
        ctx.quadraticCurveTo(
          cx + dir * hemiW * 0.5, yBase + wobble,
          cx + dir * hemiW * 0.88, yBase - wobble * 0.5
        )
        ctx.stroke()
      }
      // Below V1
      for (let i = 0; i < 2; i++) {
        const yBase = midY + hemiH * 0.45 + i * hemiH * 0.22
        ctx.beginPath()
        ctx.moveTo(cx + dir * hemiW * 0.12, yBase)
        ctx.quadraticCurveTo(
          cx + dir * hemiW * 0.5, yBase - hemiH * 0.025,
          cx + dir * hemiW * 0.82, yBase + hemiH * 0.01
        )
        ctx.stroke()
      }
      ctx.restore()
    }

    // ---- V1 region: wedge-shaped around calcarine fissure ----
    // Cortical mapping (posterior view):
    //   LEFT cortex receives RIGHT visual field (contralateral)
    //   RIGHT cortex receives LEFT visual field
    //   Dorsal V1 (above calcarine) = lower visual field
    //   Ventral V1 (below calcarine) = upper visual field
    //   Occipital pole (lateral tip) = fovea
    //   Anterior V1 (medial) = periphery
    //
    // Zone layout per hemisphere:
    //   LEFT cortex dorsal:  4 (foveal-LR), 8 (para-LR), 12 (periph-LR)
    //   LEFT cortex ventral: 2 (foveal-UR), 6 (para-UR), 10 (periph-UR)
    //   RIGHT cortex dorsal: 3 (foveal-LL), 7 (para-LL), 11 (periph-LL)
    //   RIGHT cortex ventral:1 (foveal-UL), 5 (para-UL),  9 (periph-UL)

    function drawV1(cx: number, isLeft: boolean) {
      const dir = isLeft ? -1 : 1

      // V1 dimensions: wedge from occipital pole to anterior
      const v1Len = hemiW * 0.82  // length along calcarine
      const v1MaxH = hemiH * 0.35 // max half-height at periphery

      // Eccentricity bands (from pole = foveal to anterior = peripheral)
      // Foveal gets more cortical space (cortical magnification)
      const bands = [
        { t0: 0.0, t1: 0.38 },  // foveal (over-represented)
        { t0: 0.38, t1: 0.70 }, // parafoveal
        { t0: 0.70, t1: 1.0 },  // peripheral
      ]

      let dorsalZones: number[]
      let ventralZones: number[]

      if (isLeft) {
        // Left cortex = RIGHT visual field
        dorsalZones = [4, 8, 12]    // lower-right VF: foveal, para, periph
        ventralZones = [2, 6, 10]   // upper-right VF: foveal, para, periph
      } else {
        // Right cortex = LEFT visual field
        dorsalZones = [3, 7, 11]    // lower-left VF
        ventralZones = [1, 5, 9]    // upper-left VF
      }

      for (let i = 0; i < 3; i++) {
        const t0 = bands[i].t0
        const t1 = bands[i].t1
        const tMid = (t0 + t1) / 2

        // X positions along the calcarine (from pole outward)
        const x0 = cx + dir * v1Len * (1 - t0)
        const x1 = cx + dir * v1Len * (1 - t1)

        // V1 tapers: narrow at pole (fovea), wider at anterior (periphery)
        const halfH0 = v1MaxH * (0.25 + 0.75 * t0)
        const halfH1 = v1MaxH * (0.25 + 0.75 * t1)
        const halfHMid = v1MaxH * (0.25 + 0.75 * tMid)
        const xMid = cx + dir * v1Len * (1 - tMid)

        // --- Dorsal zone (above calcarine = lower visual field) ---
        const dId = dorsalZones[i]
        const dVal = zoneAvg[dId] || 0
        const dNorm = Math.max(0, Math.min(1, (dVal - 2) / 75))
        const [dr, dg, db] = heatColor(dNorm)

        ctx.beginPath()
        if (isLeft) {
          ctx.moveTo(x0, midY)
          ctx.lineTo(x0, midY - halfH0)
          ctx.lineTo(x1, midY - halfH1)
          ctx.lineTo(x1, midY)
        } else {
          ctx.moveTo(x1, midY)
          ctx.lineTo(x1, midY - halfH1)
          ctx.lineTo(x0, midY - halfH0)
          ctx.lineTo(x0, midY)
        }
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(dr * 255)},${Math.round(dg * 255)},${Math.round(db * 255)})`
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.18)"
        ctx.lineWidth = 0.6
        ctx.stroke()

        // Zone label
        ctx.fillStyle = dNorm > 0.55 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"
        ctx.font = `bold ${Math.max(9, w * 0.022)}px monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(String(dId), xMid, midY - halfHMid * 0.50)

        // --- Ventral zone (below calcarine = upper visual field) ---
        const vId = ventralZones[i]
        const vVal = zoneAvg[vId] || 0
        const vNorm = Math.max(0, Math.min(1, (vVal - 2) / 75))
        const [vr, vg, vb] = heatColor(vNorm)

        ctx.beginPath()
        if (isLeft) {
          ctx.moveTo(x0, midY)
          ctx.lineTo(x0, midY + halfH0)
          ctx.lineTo(x1, midY + halfH1)
          ctx.lineTo(x1, midY)
        } else {
          ctx.moveTo(x1, midY)
          ctx.lineTo(x1, midY + halfH1)
          ctx.lineTo(x0, midY + halfH0)
          ctx.lineTo(x0, midY)
        }
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(vr * 255)},${Math.round(vg * 255)},${Math.round(vb * 255)})`
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.18)"
        ctx.lineWidth = 0.6
        ctx.stroke()

        // Zone label
        ctx.fillStyle = vNorm > 0.55 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"
        ctx.font = `bold ${Math.max(9, w * 0.022)}px monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(String(vId), xMid, midY + halfHMid * 0.50)
      }
    }

    // ---- Calcarine fissure line ----
    function drawCalcarine(cx: number, isLeft: boolean) {
      const dir = isLeft ? -1 : 1
      const v1Len = hemiW * 0.82

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx + dir * 2, midY)
      ctx.lineTo(cx + dir * v1Len, midY)
      ctx.strokeStyle = "rgba(255,255,255,0.55)"
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // "Calcarine fissure" label
      ctx.save()
      ctx.fillStyle = "rgba(255,255,255,0.40)"
      ctx.font = `${Math.max(7, w * 0.019)}px monospace`
      ctx.textAlign = isLeft ? "right" : "left"
      ctx.fillText("Calcarine fissure", cx + dir * (v1Len + 6), midY + 4)
      ctx.restore()
    }

    // ---- Render everything ----
    const leftCx = midX - gap / 2
    const rightCx = midX + gap / 2

    // Hemisphere outlines
    drawHemi(leftCx, true)
    drawHemi(rightCx, false)

    // V1 zones (drawn on top of hemisphere fill)
    drawV1(leftCx, true)
    drawV1(rightCx, false)

    // Calcarine fissure lines
    drawCalcarine(leftCx, true)
    drawCalcarine(rightCx, false)

    // ---- Labels ----
    const labelFont = `${Math.max(10, w * 0.026)}px monospace`
    const smallFont = `${Math.max(7, w * 0.017)}px monospace`

    // Hemisphere labels
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = labelFont
    ctx.textAlign = "center"
    ctx.fillText("Left", leftCx - hemiW * 0.45, midY - hemiH - 10)
    ctx.fillText("Right", rightCx + hemiW * 0.45, midY - hemiH - 10)

    // Primary visual cortex
    ctx.fillStyle = "rgba(255,255,255,0.28)"
    ctx.font = smallFont
    ctx.textAlign = "center"
    ctx.fillText("Primary visual cortex", midX, midY + hemiH + 20)

    // Dorsal / ventral labels at midline
    ctx.fillStyle = "rgba(255,255,255,0.22)"
    ctx.font = smallFont
    ctx.textAlign = "center"
    ctx.fillText("dorsal", midX, midY - hemiH * 0.32)
    ctx.fillText("(lower VF)", midX, midY - hemiH * 0.32 + 11)
    ctx.fillText("ventral", midX, midY + hemiH * 0.32)
    ctx.fillText("(upper VF)", midX, midY + hemiH * 0.32 + 11)

    // Fovea labels with arrow
    ctx.fillStyle = "rgba(255,255,255,0.30)"
    ctx.font = smallFont

    // Left hemisphere fovea
    ctx.textAlign = "right"
    ctx.fillText("fovea", leftCx - hemiW * 0.75, midY - 10)
    ctx.beginPath()
    ctx.moveTo(leftCx - hemiW * 0.73, midY - 6)
    ctx.lineTo(leftCx - hemiW * 0.82 + hemiW * 0.02, midY)
    ctx.strokeStyle = "rgba(255,255,255,0.18)"
    ctx.lineWidth = 0.6
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.setLineDash([])

    // Right hemisphere fovea
    ctx.textAlign = "left"
    ctx.fillText("fovea", rightCx + hemiW * 0.75, midY - 10)
    ctx.beginPath()
    ctx.moveTo(rightCx + hemiW * 0.73, midY - 6)
    ctx.lineTo(rightCx + hemiW * 0.82 - hemiW * 0.02, midY)
    ctx.strokeStyle = "rgba(255,255,255,0.18)"
    ctx.lineWidth = 0.6
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.setLineDash([])

    // Periphery labels at medial side
    ctx.fillStyle = "rgba(255,255,255,0.20)"
    ctx.font = smallFont
    ctx.textAlign = "center"
    ctx.fillText("periphery", midX, midY + 4)

  }, [matrix])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          Calcarine Fissure Map
        </h2>
      </div>
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-lg border border-border bg-[#0a0c14]">
        <canvas
          ref={canvasRef}
          width={600}
          height={360}
          className="h-full w-full"
        />
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
      <LearnMore>
        <p>
          This 2D posterior view shows both brain hemispheres with the calcarine
          fissure marked as a horizontal line through V1. The 12 numbered zones
          represent how the visual field maps onto V1 retinotopically. Zones at the
          occipital pole (lateral tip) represent the fovea (1-4), while zones closer
          to the midline represent the periphery (9-12). Dorsal V1 (above the calcarine)
          receives the lower visual field via parietal optic radiations, ventral V1
          (below) receives the upper visual field via temporal radiations. Left cortex
          maps the right visual field and vice versa (contralateral). Each zone is
          colored by the average stimulation intensity from its corresponding camera
          region.
        </p>
      </LearnMore>
    </div>
  )
}
