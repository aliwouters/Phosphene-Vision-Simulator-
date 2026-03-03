"use client"

import { useRef, useEffect, useState } from "react"
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

export function CalcarineViewer({ matrix }: CalcarineViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseImgRef = useRef<HTMLImageElement | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  // Cache which pixels are V1 (black in the base image) and their normalized positions
  const v1MapRef = useRef<{
    width: number
    height: number
    // For each V1 pixel: [index, hemisphere ('L'|'R'), isDorsal, eccentricity (0=fovea,1=periph), elevation (0=fissure,1=edge)]
    pixels: Array<{ idx: number; hemi: "L" | "R"; eccentricity: number; verticalPos: number }>
  } | null>(null)

  // Load the base brain image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      baseImgRef.current = img
      setImageLoaded(true)
    }
    img.src = "/images/calcarine-base.png"
  }, [])

  // Precompute the V1 pixel map from the base image
  useEffect(() => {
    if (!imageLoaded || !baseImgRef.current) return
    const img = baseImgRef.current

    // Draw base image to offscreen canvas to read pixel data
    const offscreen = document.createElement("canvas")
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const octx = offscreen.getContext("2d")
    if (!octx) return
    octx.drawImage(img, 0, 0)
    const imgData = octx.getImageData(0, 0, offscreen.width, offscreen.height)
    const data = imgData.data
    const w = offscreen.width
    const h = offscreen.height
    const midX = w / 2

    // Find the V1 region bounding boxes per hemisphere by scanning pink pixels
    // The pink V1 regions have high red, moderate-to-low green, high-ish blue-ish pink
    // Pink in the image is roughly R > 180, G < 120, B > 80 (magenta/hot-pink)
    const leftPixels: Array<{ x: number; y: number }> = []
    const rightPixels: Array<{ x: number; y: number }> = []

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2]
        // Detect pink: R is high, G is relatively low, B is moderate
        const isPink = r > 160 && g < 140 && b > 60 && (r - g) > 60 && data[i + 3] > 200
        if (isPink) {
          if (x < midX) {
            leftPixels.push({ x, y })
          } else {
            rightPixels.push({ x, y })
          }
        }
      }
    }

    // Find bounding box and calcarine fissure (horizontal center) for each hemisphere
    function analyzeHemi(pixels: Array<{ x: number; y: number }>) {
      if (pixels.length === 0) return null
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of pixels) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      // Calcarine fissure is the horizontal midline of the V1 region
      const fissureY = (minY + maxY) / 2
      return { minX, maxX, minY, maxY, fissureY }
    }

    const leftBounds = analyzeHemi(leftPixels)
    const rightBounds = analyzeHemi(rightPixels)

    // Build pixel map with retinotopic coordinates
    const pixelMap: Array<{ idx: number; hemi: "L" | "R"; eccentricity: number; verticalPos: number }> = []

    function mapPixels(
      pixels: Array<{ x: number; y: number }>,
      bounds: { minX: number; maxX: number; minY: number; maxY: number; fissureY: number },
      hemi: "L" | "R"
    ) {
      const v1Width = bounds.maxX - bounds.minX
      const v1Height = bounds.maxY - bounds.minY

      for (const p of pixels) {
        // Eccentricity: distance from the lateral tip (occipital pole = fovea)
        // to the medial side (periphery)
        // Left hemi: lateral = minX (left edge), medial = maxX (near midline)
        // Right hemi: lateral = maxX (right edge), medial = minX (near midline)
        let ecc: number
        if (hemi === "L") {
          ecc = (p.x - bounds.minX) / v1Width // 0 = lateral (fovea), 1 = medial (periphery)
        } else {
          ecc = (bounds.maxX - p.x) / v1Width // 0 = lateral (fovea), 1 = medial (periphery)
        }

        // Vertical position: -1 = dorsal (above calcarine), +1 = ventral (below)
        const distFromFissure = p.y - bounds.fissureY
        const maxDist = v1Height / 2
        const verticalPos = Math.max(-1, Math.min(1, distFromFissure / maxDist))

        const idx = (p.y * w + p.x) * 4
        pixelMap.push({ idx, hemi, eccentricity: ecc, verticalPos })
      }
    }

    if (leftBounds) mapPixels(leftPixels, leftBounds, "L")
    if (rightBounds) mapPixels(rightPixels, rightBounds, "R")

    v1MapRef.current = { width: w, height: h, pixels: pixelMap }
  }, [imageLoaded])

  // Render the heatmap on each frame
  useEffect(() => {
    const canvas = canvasRef.current
    const img = baseImgRef.current
    const v1Map = v1MapRef.current
    if (!canvas || !img || !v1Map || !matrix || matrix.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height

    // Draw the base image (inverted for dark theme)
    ctx.clearRect(0, 0, cw, ch)
    ctx.fillStyle = "#0a0c14"
    ctx.fillRect(0, 0, cw, ch)

    // Draw base image to offscreen at native resolution, modify pixels, then draw to display canvas
    const offscreen = document.createElement("canvas")
    offscreen.width = v1Map.width
    offscreen.height = v1Map.height
    const octx = offscreen.getContext("2d")
    if (!octx) return

    octx.drawImage(img, 0, 0)
    const imgData = octx.getImageData(0, 0, v1Map.width, v1Map.height)
    const data = imgData.data

    // Remap the base image for dark theme:
    // - White areas -> dark background
    // - Black lines (sulci) -> white/light lines
    // - Pink V1 areas -> dark placeholder (will be overwritten with heatmap)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const lum = (r + g + b) / 3
      const isPink = r > 160 && g < 140 && b > 60 && (r - g) > 60
      if (isPink) {
        // Pink V1 region -> dark, will be overwritten with heatmap
        data[i] = 8
        data[i + 1] = 13
        data[i + 2] = 35
      } else if (lum < 60) {
        // Black lines (sulci outlines) -> white lines on dark bg
        data[i] = 180
        data[i + 1] = 185
        data[i + 2] = 195
      } else if (lum > 200) {
        // White background -> dark
        data[i] = 10
        data[i + 1] = 12
        data[i + 2] = 20
      } else {
        // Grey areas -> subtle
        const t = 1 - lum / 255
        data[i] = Math.round(10 + t * 80)
        data[i + 1] = Math.round(12 + t * 85)
        data[i + 2] = Math.round(20 + t * 90)
      }
    }

    // Now color the V1 pixels with the heatmap
    const rows = matrix.length
    const cols = matrix[0]?.length || 0

    for (const px of v1Map.pixels) {
      // Map retinotopic coordinates to camera grid
      //
      // Eccentricity: 0 = fovea (center of camera), 1 = periphery (edge of camera)
      // Log-polar compression: fovea is over-represented
      const logScale = 0.35
      const eccCompressed = (Math.exp(px.eccentricity / logScale) - 1) / (Math.exp(1 / logScale) - 1)
      const ecc = Math.min(1, eccCompressed)

      // verticalPos: -1 = dorsal (above calcarine) -> lower VF -> bottom of camera (high row)
      //              +1 = ventral (below calcarine) -> upper VF -> top of camera (low row)
      const absVert = Math.abs(px.verticalPos)
      const vertSign = Math.sign(px.verticalPos)

      // Camera grid mapping:
      // Row: dorsal (verticalPos < 0) -> high row (bottom), ventral (verticalPos > 0) -> low row (top)
      // The vertical elevation determines how far from center row
      const rowFrac = 0.5 - vertSign * absVert * ecc * 0.5
      // Col: left cortex -> right VF -> low col; right cortex -> left VF -> high col
      const colFrac = px.hemi === "L"
        ? 0.5 - ecc * 0.5  // left cortex -> low col (right visual field in raw camera)
        : 0.5 + ecc * 0.5  // right cortex -> high col (left visual field in raw camera)

      const gRow = Math.floor(rowFrac * rows)
      const gCol = Math.floor(colFrac * cols)

      const clampedRow = Math.max(0, Math.min(rows - 1, gRow))
      const clampedCol = Math.max(0, Math.min(cols - 1, gCol))

      const val = matrix[clampedRow]?.[clampedCol] ?? 0
      const norm = Math.max(0, Math.min(1, (val - 2) / 75))
      const [r, g, b] = heatColor(norm)

      data[px.idx] = Math.round(r * 255)
      data[px.idx + 1] = Math.round(g * 255)
      data[px.idx + 2] = Math.round(b * 255)
    }

    octx.putImageData(imgData, 0, 0)

    // Scale and draw to display canvas
    ctx.drawImage(offscreen, 0, 0, cw, ch)

    // Add labels on top
    const midX = cw / 2
    const fontSize = Math.max(10, cw * 0.022)
    const smallFontSize = Math.max(8, cw * 0.016)

    // "Left" and "Right" hemisphere labels
    ctx.fillStyle = "rgba(255,255,255,0.45)"
    ctx.font = `${fontSize}px monospace`
    ctx.textAlign = "center"
    ctx.fillText("Left", cw * 0.25, fontSize + 8)
    ctx.fillText("Right", cw * 0.75, fontSize + 8)

    // Calcarine fissure label (along the midline divide)
    ctx.fillStyle = "rgba(0, 210, 160, 0.35)"
    ctx.font = `${smallFontSize}px monospace`
    ctx.textAlign = "center"
    ctx.fillText("calcarine fissure", midX, ch * 0.52)

    // Dorsal / ventral labels
    ctx.fillStyle = "rgba(255,255,255,0.22)"
    ctx.font = `${smallFontSize}px monospace`
    ctx.fillText("dorsal (lower VF)", midX, ch * 0.35)
    ctx.fillText("ventral (upper VF)", midX, ch * 0.68)

    // Fovea indicators
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.font = `${smallFontSize}px monospace`
    ctx.textAlign = "left"
    ctx.fillText("fovea", 8, ch * 0.52)
    ctx.textAlign = "right"
    ctx.fillText("fovea", cw - 8, ch * 0.52)

  }, [matrix, imageLoaded])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          Calcarine Fissure Map
        </h2>
      </div>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-[#0a0c14]">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
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
          This posterior view uses the actual brain anatomy as a base, with the
          black V1 regions around the calcarine fissure replaced by a real-time
          stimulation heatmap. Each pixel in the V1 region is mapped to a
          corresponding camera grid cell using retinotopic coordinates:
          eccentricity (fovea at the occipital pole to periphery at the medial
          edge) with log-polar cortical magnification, contralateral projection
          (left cortex maps right visual field), and vertical inversion (dorsal V1
          above the calcarine maps the lower visual field, ventral V1 below it maps
          the upper visual field).
        </p>
      </LearnMore>
    </div>
  )
}
