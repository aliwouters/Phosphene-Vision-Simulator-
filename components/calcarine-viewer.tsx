"use client"

import { useRef, useEffect } from "react"
import { LearnMore } from "./learn-more"

interface CalcarineViewerProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function heatColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t))
  if (v < 0.2) {
    const f = v / 0.2
    return [lerp(0.03, 0.06, f), lerp(0.05, 0.24, f), lerp(0.24, 0.43, f)]
  }
  if (v < 0.4) {
    const f = (v - 0.2) / 0.2
    return [lerp(0.06, 0.08, f), lerp(0.24, 0.71, f), lerp(0.43, 0.67, f)]
  }
  if (v < 0.6) {
    const f = (v - 0.4) / 0.2
    return [lerp(0.08, 0.63, f), lerp(0.71, 0.90, f), lerp(0.67, 0.20, f)]
  }
  if (v < 0.8) {
    const f = (v - 0.6) / 0.2
    return [lerp(0.63, 1.0, f), lerp(0.90, 0.71, f), lerp(0.20, 0.12, f)]
  }
  const f = (v - 0.8) / 0.2
  return [lerp(1.0, 1.0, f), lerp(0.71, 0.96, f), lerp(0.12, 0.86, f)]
}

// Retinotopic zone definitions (12 zones as in the reference diagrams)
// Each zone: visual field region -> cortical location
// Zone numbering matches the Horton & Hoyt diagram:
//   1-4: foveal (center), 5-8: parafoveal (mid), 9-12: peripheral (outer)
//   Odd on left visual field side, even on right visual field side
//   Upper visual field -> ventral (below calcarine), lower -> dorsal (above)
interface Zone {
  id: number
  // Camera grid sampling region (normalized 0-1)
  camRowStart: number
  camRowEnd: number
  camColStart: number
  camColEnd: number
}

// Visual field zones mapped to camera grid regions
// Camera: row 0 = top (upper visual field), col 0 = left
// CSS-mirrored display, so raw matrix col 0 = right side of world
const ZONES: Zone[] = [
  // Foveal zones (1-4): center of camera
  { id: 1, camRowStart: 0.42, camRowEnd: 0.58, camColStart: 0.42, camColEnd: 0.50 },
  { id: 2, camRowStart: 0.42, camRowEnd: 0.58, camColStart: 0.50, camColEnd: 0.58 },
  { id: 3, camRowStart: 0.33, camRowEnd: 0.42, camColStart: 0.42, camColEnd: 0.58 },
  { id: 4, camRowStart: 0.58, camRowEnd: 0.67, camColStart: 0.42, camColEnd: 0.58 },
  // Parafoveal zones (5-8): mid ring
  { id: 5, camRowStart: 0.25, camRowEnd: 0.42, camColStart: 0.25, camColEnd: 0.50 },
  { id: 6, camRowStart: 0.25, camRowEnd: 0.42, camColStart: 0.50, camColEnd: 0.75 },
  { id: 7, camRowStart: 0.58, camRowEnd: 0.75, camColStart: 0.25, camColEnd: 0.50 },
  { id: 8, camRowStart: 0.58, camRowEnd: 0.75, camColStart: 0.50, camColEnd: 0.75 },
  // Peripheral zones (9-12): outer ring
  { id: 9, camRowStart: 0.0, camRowEnd: 0.25, camColStart: 0.0, camColEnd: 0.50 },
  { id: 10, camRowStart: 0.0, camRowEnd: 0.25, camColStart: 0.50, camColEnd: 1.0 },
  { id: 11, camRowStart: 0.75, camRowEnd: 1.0, camColStart: 0.0, camColEnd: 0.50 },
  { id: 12, camRowStart: 0.75, camRowEnd: 1.0, camColStart: 0.50, camColEnd: 1.0 },
]

function getZoneAverage(matrix: number[][], zone: Zone): number {
  const rows = matrix.length
  const cols = matrix[0]?.length || 0
  const r0 = Math.floor(zone.camRowStart * rows)
  const r1 = Math.min(rows, Math.ceil(zone.camRowEnd * rows))
  const c0 = Math.floor(zone.camColStart * cols)
  const c1 = Math.min(cols, Math.ceil(zone.camColEnd * cols))
  let sum = 0
  let count = 0
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (matrix[r]?.[c] !== undefined) {
        sum += matrix[r][c]
        count++
      }
    }
  }
  return count > 0 ? sum / count : 0
}

export function CalcarineViewer({ matrix, gridRows, gridCols }: CalcarineViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !matrix || matrix.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = "#0a0c14"
    ctx.fillRect(0, 0, w, h)

    const midX = w / 2
    const midY = h / 2
    const hemiW = w * 0.42 // hemisphere width
    const hemiH = h * 0.42 // hemisphere height
    const gap = w * 0.03   // gap between hemispheres

    // Compute zone averages
    const zoneValues: Record<number, number> = {}
    for (const zone of ZONES) {
      zoneValues[zone.id] = getZoneAverage(matrix, zone)
    }

    // Draw a hemisphere outline (posterior view, simplified brain shape)
    function drawHemisphereOutline(cx: number, cy: number, isLeft: boolean) {
      ctx.save()
      ctx.beginPath()
      const xDir = isLeft ? -1 : 1
      // Simplified posterior brain hemisphere shape
      ctx.moveTo(cx, cy - hemiH)
      // Top curve
      ctx.bezierCurveTo(
        cx + xDir * hemiW * 0.6, cy - hemiH,
        cx + xDir * hemiW, cy - hemiH * 0.5,
        cx + xDir * hemiW, cy
      )
      // Bottom curve
      ctx.bezierCurveTo(
        cx + xDir * hemiW, cy + hemiH * 0.5,
        cx + xDir * hemiW * 0.6, cy + hemiH,
        cx, cy + hemiH
      )
      // Medial side (straight-ish)
      ctx.lineTo(cx, cy - hemiH)
      ctx.closePath()
      ctx.strokeStyle = "rgba(255,255,255,0.15)"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    // Draw calcarine fissure (horizontal line across V1 area)
    function drawCalcarine(cx: number, cy: number, isLeft: boolean) {
      const xDir = isLeft ? -1 : 1
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + xDir * hemiW * 0.85, cy)
      ctx.strokeStyle = "rgba(255,255,255,0.5)"
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // Label
      ctx.save()
      ctx.fillStyle = "rgba(255,255,255,0.4)"
      ctx.font = `${Math.max(8, w * 0.022)}px monospace`
      ctx.textAlign = isLeft ? "right" : "left"
      const labelX = cx + xDir * hemiW * 0.88
      ctx.fillText("calcarine", labelX, cy + 3)
      ctx.restore()
    }

    // Draw V1 region with retinotopic zones
    // V1 sits around the calcarine fissure at the medial/posterior occipital lobe
    // Foveal zones (1-4) at the occipital pole (lateral tip)
    // Peripheral zones (9-12) more anterior (medial side)
    function drawV1Zones(cx: number, cy: number, isLeft: boolean) {
      const xDir = isLeft ? -1 : 1

      // V1 region shape parameters
      const v1W = hemiW * 0.75
      const v1H = hemiH * 0.65

      // Zone layout for one hemisphere
      // Left cortex sees RIGHT visual field (contralateral)
      // Right cortex sees LEFT visual field
      // Dorsal (above calcarine) = lower visual field
      // Ventral (below calcarine) = upper visual field
      //
      // Per the Horton & Hoyt diagram:
      // LEFT hemisphere: zones 4,8,12 (dorsal), zones 3,7,11 (ventral) - from RIGHT visual field
      // RIGHT hemisphere: zones 10,6,2 (dorsal), zones 9,5,1 (ventral) - from LEFT visual field

      interface ZoneShape {
        zoneId: number
        path: (ctx: CanvasRenderingContext2D) => void
      }

      const zoneShapes: ZoneShape[] = []

      // Foveal zones: near the occipital pole (outer tip, furthest from midline)
      // Parafoveal: middle
      // Peripheral: closest to midline (anterior V1)

      // Eccentricity rings (distance from occipital pole along fissure)
      const eccBands = [
        { start: 0.0, end: 0.33 },   // foveal
        { start: 0.33, end: 0.66 },   // parafoveal
        { start: 0.66, end: 1.0 },    // peripheral
      ]

      // Zone assignments per hemisphere
      // Dorsal (above calcarine, y < cy) and Ventral (below calcarine, y > cy)
      let dorsalZones: number[]
      let ventralZones: number[]

      if (isLeft) {
        // Left cortex = RIGHT visual field
        // Dorsal = lower right VF, Ventral = upper right VF
        dorsalZones = [4, 8, 12]   // foveal, para, peripheral
        ventralZones = [3, 7, 11]
      } else {
        // Right cortex = LEFT visual field
        dorsalZones = [2, 6, 10]
        ventralZones = [1, 5, 9]
      }

      // Build zone shapes
      for (let i = 0; i < 3; i++) {
        const ecc0 = eccBands[i].start
        const ecc1 = eccBands[i].end
        const x0 = cx + xDir * (v1W * (1 - ecc1))
        const x1 = cx + xDir * (v1W * (1 - ecc0))
        const halfH0 = v1H * (0.3 + 0.7 * (1 - ecc0))
        const halfH1 = v1H * (0.3 + 0.7 * (1 - ecc1))

        // Dorsal zone (above calcarine)
        zoneShapes.push({
          zoneId: dorsalZones[i],
          path: (c) => {
            c.beginPath()
            if (isLeft) {
              c.moveTo(x1, cy)
              c.lineTo(x1, cy - halfH1)
              c.lineTo(x0, cy - halfH0)
              c.lineTo(x0, cy)
            } else {
              c.moveTo(x0, cy)
              c.lineTo(x0, cy - halfH0)
              c.lineTo(x1, cy - halfH1)
              c.lineTo(x1, cy)
            }
            c.closePath()
          },
        })

        // Ventral zone (below calcarine)
        zoneShapes.push({
          zoneId: ventralZones[i],
          path: (c) => {
            c.beginPath()
            if (isLeft) {
              c.moveTo(x1, cy)
              c.lineTo(x1, cy + halfH1)
              c.lineTo(x0, cy + halfH0)
              c.lineTo(x0, cy)
            } else {
              c.moveTo(x0, cy)
              c.lineTo(x0, cy + halfH0)
              c.lineTo(x1, cy + halfH1)
              c.lineTo(x1, cy)
            }
            c.closePath()
          },
        })
      }

      // Draw each zone
      for (const zs of zoneShapes) {
        const val = zoneValues[zs.zoneId] || 0
        const norm = (val - 2) / 75
        const [r, g, b] = heatColor(norm)

        ctx.save()
        zs.path(ctx)
        ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.2)"
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.restore()

        // Zone number label
        ctx.save()
        zs.path(ctx)
        // Find centroid of path bounding box for label placement
        const bbox = getPathBBox(ctx)
        ctx.restore()

        if (bbox) {
          ctx.save()
          ctx.fillStyle = norm > 0.5 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)"
          ctx.font = `${Math.max(9, w * 0.025)}px monospace`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(String(zs.zoneId), bbox.cx, bbox.cy)
          ctx.restore()
        }
      }
    }

    function getPathBBox(_ctx: CanvasRenderingContext2D) {
      // We'll compute centroids analytically based on the zone shape
      // This is a simplification; we'll use the last drawn path's bounds
      // Instead, we track coordinates in the zone shapes
      return null as { cx: number; cy: number } | null
    }

    // Draw V1 zones with centroid labels using direct coordinate calculation
    function drawV1ZonesWithLabels(cx: number, cy: number, isLeft: boolean) {
      const xDir = isLeft ? -1 : 1
      const v1W = hemiW * 0.75
      const v1H = hemiH * 0.65

      const eccBands = [
        { start: 0.0, end: 0.33 },
        { start: 0.33, end: 0.66 },
        { start: 0.66, end: 1.0 },
      ]

      let dorsalZones: number[]
      let ventralZones: number[]

      if (isLeft) {
        dorsalZones = [4, 8, 12]
        ventralZones = [3, 7, 11]
      } else {
        dorsalZones = [2, 6, 10]
        ventralZones = [1, 5, 9]
      }

      for (let i = 0; i < 3; i++) {
        const ecc0 = eccBands[i].start
        const ecc1 = eccBands[i].end
        const eccMid = (ecc0 + ecc1) / 2
        const x0 = cx + xDir * (v1W * (1 - ecc1))
        const x1 = cx + xDir * (v1W * (1 - ecc0))
        const halfH0 = v1H * (0.3 + 0.7 * (1 - ecc0))
        const halfH1 = v1H * (0.3 + 0.7 * (1 - ecc1))
        const midX_zone = cx + xDir * (v1W * (1 - eccMid))
        const halfHMid = v1H * (0.3 + 0.7 * (1 - eccMid))

        // Dorsal
        const dorsalId = dorsalZones[i]
        const dorsalVal = zoneValues[dorsalId] || 0
        const dorsalNorm = (dorsalVal - 2) / 75
        const [dr, dg, db] = heatColor(dorsalNorm)

        ctx.beginPath()
        if (isLeft) {
          ctx.moveTo(x1, cy); ctx.lineTo(x1, cy - halfH1)
          ctx.lineTo(x0, cy - halfH0); ctx.lineTo(x0, cy)
        } else {
          ctx.moveTo(x0, cy); ctx.lineTo(x0, cy - halfH0)
          ctx.lineTo(x1, cy - halfH1); ctx.lineTo(x1, cy)
        }
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(dr * 255)}, ${Math.round(dg * 255)}, ${Math.round(db * 255)})`
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.2)"
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Label
        ctx.fillStyle = dorsalNorm > 0.5 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"
        ctx.font = `${Math.max(9, w * 0.024)}px monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(String(dorsalId), midX_zone, cy - halfHMid * 0.5)

        // Ventral
        const ventralId = ventralZones[i]
        const ventralVal = zoneValues[ventralId] || 0
        const ventralNorm = (ventralVal - 2) / 75
        const [vr, vg, vb] = heatColor(ventralNorm)

        ctx.beginPath()
        if (isLeft) {
          ctx.moveTo(x1, cy); ctx.lineTo(x1, cy + halfH1)
          ctx.lineTo(x0, cy + halfH0); ctx.lineTo(x0, cy)
        } else {
          ctx.moveTo(x0, cy); ctx.lineTo(x0, cy + halfH0)
          ctx.lineTo(x1, cy + halfH1); ctx.lineTo(x1, cy)
        }
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.round(vr * 255)}, ${Math.round(vg * 255)}, ${Math.round(vb * 255)})`
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.2)"
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Label
        ctx.fillStyle = ventralNorm > 0.5 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"
        ctx.font = `${Math.max(9, w * 0.024)}px monospace`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(String(ventralId), midX_zone, cy + halfHMid * 0.5)
      }
    }

    // Left hemisphere (cx to the left of midline)
    const leftCx = midX - gap / 2
    const rightCx = midX + gap / 2

    drawHemisphereOutline(leftCx, midY, true)
    drawHemisphereOutline(rightCx, midY, false)

    drawV1ZonesWithLabels(leftCx, midY, true)
    drawV1ZonesWithLabels(rightCx, midY, false)

    drawCalcarine(leftCx, midY, true)
    drawCalcarine(rightCx, midY, false)

    // Draw sulci/gyri lines for brain detail
    function drawBrainDetail(cx: number, cy: number, isLeft: boolean) {
      const xDir = isLeft ? -1 : 1
      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.07)"
      ctx.lineWidth = 0.5

      // A few curved sulcus lines above V1
      for (let i = 1; i <= 3; i++) {
        const yOff = -hemiH * (0.3 + i * 0.18)
        ctx.beginPath()
        ctx.moveTo(cx + xDir * hemiW * 0.1, cy + yOff)
        ctx.quadraticCurveTo(
          cx + xDir * hemiW * 0.5, cy + yOff + hemiH * 0.05 * (i % 2 === 0 ? 1 : -1),
          cx + xDir * hemiW * 0.85, cy + yOff + hemiH * 0.02
        )
        ctx.stroke()
      }

      // Below V1
      for (let i = 1; i <= 2; i++) {
        const yOff = hemiH * (0.3 + i * 0.2)
        ctx.beginPath()
        ctx.moveTo(cx + xDir * hemiW * 0.15, cy + yOff)
        ctx.quadraticCurveTo(
          cx + xDir * hemiW * 0.5, cy + yOff - hemiH * 0.04,
          cx + xDir * hemiW * 0.8, cy + yOff
        )
        ctx.stroke()
      }

      ctx.restore()
    }

    drawBrainDetail(leftCx, midY, true)
    drawBrainDetail(rightCx, midY, false)

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = `${Math.max(10, w * 0.028)}px monospace`
    ctx.textAlign = "center"
    ctx.fillText("Left", leftCx - hemiW * 0.4, midY - hemiH - 8)
    ctx.fillText("Right", rightCx + hemiW * 0.4, midY - hemiH - 8)

    // "Primary visual cortex" label
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.font = `${Math.max(8, w * 0.02)}px monospace`
    ctx.fillText("Primary visual cortex", midX, cy + hemiH + 16)

    // Dorsal/Ventral labels
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.font = `${Math.max(7, w * 0.018)}px monospace`
    ctx.fillText("dorsal", midX, midY - hemiH * 0.35)
    ctx.fillText("ventral", midX, midY + hemiH * 0.35)

    // Fovea indicator arrow at occipital pole
    const fontSize = Math.max(7, w * 0.018)
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.font = `${fontSize}px monospace`
    ctx.textAlign = "left"
    ctx.fillText("fovea", rightCx + hemiW * 0.7, midY - 12)
    ctx.beginPath()
    ctx.moveTo(rightCx + hemiW * 0.68, midY - 8)
    ctx.lineTo(rightCx + hemiW * 0.02, midY)
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.textAlign = "right"
    ctx.fillText("fovea", leftCx - hemiW * 0.7, midY - 12)
    ctx.beginPath()
    ctx.moveTo(leftCx - hemiW * 0.68, midY - 8)
    ctx.lineTo(leftCx - hemiW * 0.02, midY)
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 2])
    ctx.stroke()
    ctx.setLineDash([])

  }, [matrix, gridRows, gridCols])

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
          width={500}
          height={300}
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
          This 2D view shows the posterior aspect of both brain hemispheres with the
          calcarine fissure marked as a horizontal line across each hemisphere. The 12
          numbered zones represent how the visual field is mapped onto V1 following
          retinotopic organization. Zones 1-4 (foveal) sit at the occipital pole, zones
          5-8 (parafoveal) in the middle, and zones 9-12 (peripheral) toward the
          anterior extent of V1. Above the calcarine fissure is dorsal V1 (representing
          the lower visual field), below is ventral V1 (upper visual field). Each zone
          is colored by the average stimulation intensity sampled from the corresponding
          region of the camera feed.
        </p>
      </LearnMore>
    </div>
  )
}
