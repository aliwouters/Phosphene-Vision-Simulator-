"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { LearnMore } from "./learn-more"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// Cold blue -> cyan -> green -> yellow -> white
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

// Non-V1 brain surface color (dim neutral grey-blue)
const BASE_R = 0.55
const BASE_G = 0.55
const BASE_B = 0.58

export function OccipitalHeatmap3D({
  matrix,
  gridRows,
  gridCols,
}: OccipitalHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mvRef = useRef<HTMLElement | null>(null)
  const insetCanvasRef = useRef<HTMLCanvasElement>(null)
  const scriptLoaded = useRef(false)
  const [ready, setReady] = useState(false)
  const meshDataRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colorAttr: any
    positions: Float32Array
    vertCount: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mesh: any
    bounds: {
      minX: number; maxX: number
      minY: number; maxY: number
      minZ: number; maxZ: number
    }
  } | null>(null)
  const matrixRef = useRef(matrix)
  matrixRef.current = matrix

  // Load model-viewer script
  useEffect(() => {
    if (scriptLoaded.current) {
      setReady(true)
      return
    }
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
    document.head.appendChild(script)
  }, [])

  // Once model is loaded, access internal Three.js scene and set up vertex colors
  const onModelLoad = useCallback(() => {
    const mv = mvRef.current
    if (!mv) return

    // Access internal Three.js scene via Symbol
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const symbols = Object.getOwnPropertySymbols(mv as any)
    const sceneSym = symbols.find((s) => s.description === "scene")
    if (!sceneSym) {
      console.log("[v0] Could not find scene symbol, trying alternative...")
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scene = (mv as any)[sceneSym]
    if (!scene) return



    // Find the mesh in the scene
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let brainMesh: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        if (!brainMesh || child.geometry.getAttribute("position").count > brainMesh.geometry.getAttribute("position").count) {
          brainMesh = child
        }
      }
    })

    if (!brainMesh) {
      console.log("[v0] No mesh found in scene")
      return
    }

    const geo = brainMesh.geometry
    const positions = geo.getAttribute("position")
    const vertCount = positions.count


    // Create vertex color attribute if it doesn't exist
    let colorAttr = geo.getAttribute("color")
    if (!colorAttr) {
      const colors = new Float32Array(vertCount * 3)
      // Initialize all to base color
      for (let i = 0; i < vertCount; i++) {
        colors[i * 3] = BASE_R
        colors[i * 3 + 1] = BASE_G
        colors[i * 3 + 2] = BASE_B
      }

      // We need to access Three.js Color buffer attribute constructor
      // from the internal Three.js instance that model-viewer uses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const THREE = (window as any).THREE || getThreeFromModelViewer(mv)

      if (THREE && THREE.BufferAttribute) {
        colorAttr = new THREE.BufferAttribute(colors, 3)
      } else {
        // Fallback: create attribute from the same constructor as position
        const PositionConstructor = positions.constructor
        colorAttr = new PositionConstructor(colors, 3)
      }
      geo.setAttribute("color", colorAttr)
    }

    // Enable vertex colors on the material
    if (brainMesh.material) {
      brainMesh.material.vertexColors = true
      brainMesh.material.needsUpdate = true
    }

    // Copy position data
    const posArray = new Float32Array(vertCount * 3)
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < vertCount; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      posArray[i * 3] = x
      posArray[i * 3 + 1] = y
      posArray[i * 3 + 2] = z
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }



    meshDataRef.current = {
      colorAttr,
      positions: posArray,
      vertCount,
      mesh: brainMesh,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    }

    // Do initial paint
    paintV1Heatmap()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getThreeFromModelViewer(mv: any) {
    // Try to get THREE from the model-viewer's internal renderer
    try {
      const symbols = Object.getOwnPropertySymbols(mv)
      for (const sym of symbols) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (mv as any)[sym]
        if (val && val.renderer && val.renderer.threeRenderer) {
          // We can get constructors from existing objects
          return null // We'll use the position constructor fallback
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  const paintV1Heatmap = useCallback(() => {
    const data = meshDataRef.current
    if (!data) return
    const mat = matrixRef.current
    if (!mat || mat.length === 0) return

    const { colorAttr, positions, vertCount, mesh, bounds } = data
    const { minX, maxX, minY, maxY } = bounds
    const yRange = maxY - minY
    const _xRange = maxX - minX

    const gRows = mat.length
    const gCols = mat[0]?.length || 0
    const halfRows = gRows / 2
    const halfCols = gCols / 2

    // V1 center at the occipital pole -- user-provided target point
    // Model axes: x=left(-)/right(+), y=inferior(-)/superior(+), z=anterior(-)/posterior(+)
    // The occipital pole (foveal confluence) is at the user's target:
    const v1X = -13.08
    const v1Y = 10.93
    const v1Z = 81.89
    // V1 spans ~20-25mm from the occipital pole anteriorly along calcarine sulcus
    // Use a tighter radius for anatomical accuracy
    const v1Radius = 25.0
    const fadeStart = 18.0

    const colors = colorAttr.array

    for (let i = 0; i < vertCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]

      const dx = x - v1X
      const dy = y - v1Y
      const dz = z - v1Z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < v1Radius) {
        // V1 retinotopic mapping (Schwartz 1977, Horton & Hoyt 1991)
        // The cortex is a MIRROR + UPSIDE-DOWN version of the visual field:
        //   Left cortex (x < v1X)  -> RIGHT visual field (contralateral)
        //   Right cortex (x > v1X) -> LEFT visual field (contralateral)
        //   Dorsal V1 (y > v1Y)    -> LOWER visual field (inverted)
        //   Ventral V1 (y < v1Y)   -> UPPER visual field (inverted)
        //   Occipital pole (z=v1Z) -> Fovea (center of gaze)
        //   Anterior from pole     -> Periphery (log-polar compressed)

        // Eccentricity: z-distance from pole, log-polar compressed
        const zDelta = v1Z - z // positive = anterior = more peripheral
        const zNorm = Math.max(0, zDelta) / v1Radius
        const logScale = 0.35
        const eccentricity =
          (Math.exp(zNorm / logScale) - 1) /
          (Math.exp(1 / logScale) - 1)

        // Cortical x,y offset from V1 center
        const xDelta = x - v1X // positive = right cortex
        const yDelta = y - v1Y // positive = dorsal cortex
        const lateralDist = Math.sqrt(xDelta * xDelta + yDelta * yDelta)
        const corticalAngle = Math.atan2(yDelta, xDelta)

        // Combine z-eccentricity with lateral offset for total eccentricity
        const totalEcc = Math.min(1.0, Math.sqrt(eccentricity * eccentricity + (lateralDist / v1Radius) * (lateralDist / v1Radius)))

        // Map cortex -> camera matrix via visual pathway:
        //
        // Camera display is CSS-mirrored (selfie), so:
        //   Screen-LEFT = HIGH col in raw matrix, Screen-RIGHT = LOW col
        //
        // CONTRALATERAL (optic chiasm):
        //   Left cortex (xDelta<0) -> RIGHT visual field -> screen-RIGHT -> LOW col in matrix
        //   cos(corticalAngle) is negative when xDelta<0 -> colFraction<0 -> gCol < halfCols (low) 
        //   Right cortex (xDelta>0) -> LEFT visual field -> screen-LEFT -> HIGH col
        //   cos(corticalAngle) is positive when xDelta>0 -> colFraction>0 -> gCol > halfCols (high)
        //
        // VERTICAL INVERSION (parietal/temporal radiations):
        //   Dorsal (yDelta>0) -> LOWER visual field -> screen-BOTTOM -> HIGH row
        //   sin(corticalAngle) is positive when yDelta>0 -> rowFraction>0 -> gRow > halfRows (high)
        //   Ventral (yDelta<0) -> UPPER visual field -> screen-TOP -> LOW row
        //   sin(corticalAngle) is negative -> rowFraction<0 -> gRow < halfRows (low)
        const colFraction = Math.cos(corticalAngle) * totalEcc
        const rowFraction = Math.sin(corticalAngle) * totalEcc

        const gCol = Math.floor(halfCols + colFraction * halfCols)
        const gRow = Math.floor(halfRows + rowFraction * halfRows)

        if (
          gRow >= 0 && gRow < gRows &&
          gCol >= 0 && gCol < gCols &&
          mat[gRow] && mat[gRow][gCol] !== undefined
        ) {
          const value = mat[gRow][gCol]
          const normalized = (value - 2) / 75

          let fade = 1.0
          if (dist > fadeStart) {
            fade = 1.0 - (dist - fadeStart) / (v1Radius - fadeStart)
            fade = fade * fade
          }

          const [r, g, b] = heatColor(normalized)
          colors[i * 3] = BASE_R + (r - BASE_R) * fade
          colors[i * 3 + 1] = BASE_G + (g - BASE_G) * fade
          colors[i * 3 + 2] = BASE_B + (b - BASE_B) * fade
        } else {
          colors[i * 3] = BASE_R
          colors[i * 3 + 1] = BASE_G
          colors[i * 3 + 2] = BASE_B
        }
      } else {
        colors[i * 3] = BASE_R
        colors[i * 3 + 1] = BASE_G
        colors[i * 3 + 2] = BASE_B
      }
    }

    colorAttr.needsUpdate = true
    if (mesh.material) {
      mesh.material.needsUpdate = true
    }

    // Force model-viewer to re-render
    const mv = mvRef.current
    if (mv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mvAny = mv as any

      // Try multiple approaches to force a re-render
      // 1) The internal needsRender symbol
      const symbols = Object.getOwnPropertySymbols(mvAny)
      const needsRenderSym = symbols.find((s) => s.description === "needsRender")
      if (needsRenderSym) mvAny[needsRenderSym]()

      // 2) The scene's renderer directly
      const rendererSym = symbols.find((s) => s.description === "renderer")
      if (rendererSym && mvAny[rendererSym]) {
        const renderer = mvAny[rendererSym]
        if (renderer.threeRenderer) renderer.threeRenderer.render?.(renderer.scene, renderer.camera)
      }

      // 3) Nudge the exposure to force a dirty flag
      const currentExposure = mvAny.exposure || 0.6
      mvAny.exposure = currentExposure + 0.0001
      requestAnimationFrame(() => {
        mvAny.exposure = currentExposure
      })
    }
  }, [])

  // Repaint heatmap whenever matrix changes
  useEffect(() => {
    paintV1Heatmap()
  }, [matrix, gridRows, gridCols, paintV1Heatmap])

  // Use requestAnimationFrame for continuous live updates
  useEffect(() => {
    let animId: number
    let lastTime = 0
    const loop = (time: number) => {
      // Throttle to ~15fps to keep performance reasonable with 2M vertices
      if (time - lastTime > 66) {
        paintV1Heatmap()
        lastTime = time
      }
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [paintV1Heatmap])

  // Paint the 2D inset: a MIRROR + UPSIDE-DOWN version of the camera feed
  // with log-polar V1 retinotopic scaling (Schwartz 1977)
  //
  // This is the cortical surface view:
  //   Left side (L ctx)  = left cortex  = sees RIGHT visual field (contralateral)
  //   Right side (R ctx) = right cortex = sees LEFT visual field (contralateral)
  //   Top (dorsal)       = dorsal V1    = sees LOWER visual field (inverted)
  //   Bottom (ventral)   = ventral V1   = sees UPPER visual field (inverted)
  //   Center             = occipital pole = fovea
  //   Edges              = anterior V1  = periphery
  useEffect(() => {
    const canvas = insetCanvasRef.current
    if (!canvas || !matrix || matrix.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = 60
    const h = 60
    const rows = matrix.length
    const cols = matrix[0]?.length || 0

    ctx.fillStyle = "#060810"
    ctx.fillRect(0, 0, w, h)

    // For each pixel on the 2D cortex map, find which camera grid cell it sees
    const step = 1
    for (let py = 0; py < h; py += step) {
      for (let px = 0; px < w; px += step) {
        // Cortical position normalized to [-1, 1]
        const u = (px - w / 2) / (w / 2)  // -1=left cortex, +1=right cortex
        const v = (py - h / 2) / (h / 2)  // -1=dorsal, +1=ventral

        // Log-polar: expand from cortex center outward (foveal magnification)
        const logScale = 0.35
        const absU = Math.abs(u)
        const absV = Math.abs(v)
        const eccU = Math.min(1, (Math.exp(absU / logScale) - 1) / (Math.exp(1 / logScale) - 1))
        const eccV = Math.min(1, (Math.exp(absV / logScale) - 1) / (Math.exp(1 / logScale) - 1))

        // Map cortex position -> camera matrix position via visual pathway:
        //
        // Camera is CSS-mirrored for selfie display, so:
        //   Screen-LEFT  = camera-RIGHT = HIGH col in raw matrix
        //   Screen-RIGHT = camera-LEFT  = LOW col in raw matrix
        //
        // CONTRALATERAL projection (optic chiasm crossing):
        //   Left cortex  (u<0) sees RIGHT visual field = screen-RIGHT = LOW col
        //   Right cortex (u>0) sees LEFT visual field  = screen-LEFT  = HIGH col
        //   -> gCol moves WITH u: u<0 -> low col, u>0 -> high col
        //
        // VERTICAL INVERSION (parietal/temporal optic radiations):
        //   Dorsal V1 (v<0, top of map)   sees LOWER visual field = screen-BOTTOM = HIGH row
        //   Ventral V1 (v>0, bottom of map) sees UPPER visual field = screen-TOP = LOW row
        //   -> gRow moves OPPOSITE to v: v<0 -> high row, v>0 -> low row
        const gCol = Math.floor(cols / 2 + eccU * (cols / 2) * Math.sign(u))
        const gRow = Math.floor(rows / 2 - eccV * (rows / 2) * Math.sign(v))

        if (
          gRow >= 0 && gRow < rows &&
          gCol >= 0 && gCol < cols &&
          matrix[gRow] && matrix[gRow][gCol] !== undefined
        ) {
          const value = matrix[gRow][gCol]
          const normalized = (value - 2) / 75
          const [rv, gv, bv] = heatColor(normalized)
          ctx.fillStyle = `rgb(${Math.round(rv * 255)}, ${Math.round(gv * 255)}, ${Math.round(bv * 255)})`
          ctx.fillRect(px, py, step, step)
        }
      }
    }

    // Calcarine sulcus (horizontal) and vertical meridian
    ctx.strokeStyle = "rgba(255,255,255,0.25)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
    ctx.setLineDash([])

    // Fovea dot
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.8)"
    ctx.fill()

    // Labels
    ctx.fillStyle = "rgba(0, 210, 160, 0.4)"
    ctx.font = "4.5px monospace"
    ctx.textAlign = "center"
    ctx.fillText("L ctx", 8, h / 2 + 2)
    ctx.fillText("R ctx", w - 8, h / 2 + 2)
    ctx.fillText("dorsal", w / 2, 6)
    ctx.fillText("ventral", w / 2, h - 2)
  }, [matrix])

  // Attach load event to model-viewer element
  useEffect(() => {
    if (!ready) return
    const checkMv = () => {
      const mv = containerRef.current?.querySelector("model-viewer")
      if (mv) {
        mvRef.current = mv
        mv.addEventListener("load", onModelLoad)
        // Also try in case already loaded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((mv as any).loaded) onModelLoad()
      }
    }
    // Small delay to ensure DOM is ready
    const t = setTimeout(checkMv, 200)
    return () => {
      clearTimeout(t)
      if (mvRef.current) {
        mvRef.current.removeEventListener("load", onModelLoad)
      }
    }
  }, [ready, onModelLoad])

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
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#0a0c14]"
      >
        {ready ? (
          <model-viewer
            src="/models/full_brain_binary.glb"
            camera-controls
            tone-mapping="neutral"
            exposure="0.6"
            shadow-intensity="0"
            camera-target="-13.08m 10.93m 81.89m"
            camera-orbit="0deg 80deg 300m"
            min-camera-orbit="auto auto 10m"
            max-camera-orbit="auto auto 2000m"
            min-field-of-view="5deg"
            max-field-of-view="120deg"
            interaction-prompt="none"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#0a0c14",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ["--poster-color" as any]: "#0a0c14",
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              Loading 3D viewer...
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          drag to rotate / scroll to zoom
        </div>
        <div className="absolute bottom-2 right-2 z-10 rounded border border-border bg-[#060810]/90 p-1">
          <canvas
            ref={insetCanvasRef}
            width={60}
            height={60}
            className="block"
            style={{ width: 60, height: 60 }}
          />
          <p className="mt-0.5 text-center font-mono text-[7px] text-muted-foreground">
            V1 Retinotopy
          </p>
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
  <LearnMore step={4}>
    <p className="mb-1.5">
      This map visualizes how the camera image is retinotopically projected onto
      the primary visual cortex (V1) in the occipital lobe, following the human
      visual pathway:
    </p>
    <ul className="mb-1.5 list-inside list-disc space-y-1">
      <li>
        <strong className="text-foreground">Contralateral projection</strong>{" \u2014 "}
        at the optic chiasm, nasal retinal fibers cross so that the left visual
        field maps to the right hemisphere, and vice versa.
      </li>
      <li>
        <strong className="text-foreground">Vertical inversion</strong>{" \u2014 "}
        parietal optic radiations carry the lower visual field to dorsal V1
        (above the calcarine sulcus), while temporal radiations carry the upper
        field to ventral V1 (below the calcarine).
      </li>
      <li>
        <strong className="text-foreground">Foveal magnification</strong>{" \u2014 "}
        the fovea maps to the occipital pole and takes up a disproportionately
        large cortical area (~50% of V1 for the central 10{'\u00B0'}), following a
        log-polar transform (Schwartz 1977).
      </li>
    </ul>
    <p>
      Heatmap colors represent stimulation intensity at each cortical location,
      from cold blue (low current, ~2 {'\u03BCA'}) to hot white (high current,
      ~77 {'\u03BCA'}). The 2D inset in the corner shows the same mapping as a
      flat cortical surface view.
    </p>
  </LearnMore>
  </div>
  )
}
