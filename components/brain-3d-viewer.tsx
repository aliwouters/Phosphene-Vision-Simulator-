"use client"

import { useRef, useEffect, useState, useCallback } from "react"

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

    console.log("[v0] Got internal Three.js scene:", scene)

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
    console.log("[v0] Found brain mesh with", vertCount, "vertices")

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

    console.log("[v0] Brain bounds:", { minX, maxX, minY, maxY, minZ, maxZ })

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

    // V1 center at the occipital pole (POSTERIOR end of the brain)
    // Model bounds: x[-76,59], y[-56,79], z[-87,85]
    // Confirmed: z=-75 mapped to FRONTAL lobe, so z=+85 is POSTERIOR (occipital)
    // Model axes: x=left(-)/right(+), y=inferior(-)/superior(+), z=anterior(-)/posterior(+)
    // Occipital pole is at high positive z, medial x ~ -8, mid-height y ~ 12
    const v1X = -8.0
    const v1Y = 12.0
    const v1Z = 78.0
    const v1Radius = 35.0
    const fadeStart = 25.0

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
        // Retinotopic V1 mapping (Schwartz 1977, Horton & Hoyt 1991):
        // - Eccentricity: distance from the occipital pole along z-axis
        //   (pole = fovea, further anterior = peripheral vision)
        // - Polar angle: y-axis maps dorsal(+)/ventral(-) banks of calcarine sulcus
        //   dorsal V1 = lower visual field, ventral V1 = upper visual field
        // - x-axis maps left/right visual hemifield

        // Eccentricity from log-polar: z-distance from pole
        const zDist = Math.abs(z - v1Z) / v1Radius
        const logScale = 0.4
        const eccentricity =
          (Math.exp(zDist / logScale) - 1) /
          (Math.exp(1 / logScale) - 1)
        const maxEcc = Math.sqrt(halfRows * halfRows + halfCols * halfCols)
        const ecc = eccentricity * maxEcc

        // Polar angle from y (dorsal/ventral split at calcarine sulcus)
        // y > v1Y = dorsal bank (lower visual field)
        // y < v1Y = ventral bank (upper visual field)
        const yNorm = (y - v1Y) / (yRange * 0.5)
        const polarAngle = yNorm * Math.PI * 0.42

        // x determines left/right hemifield
        const xNorm = (x - v1X) / ((bounds.maxX - bounds.minX) * 0.5)

        const visualX = ecc * Math.cos(polarAngle) * Math.sign(xNorm || 1)
        const visualY = ecc * Math.sin(polarAngle)

        const gCol = Math.floor(halfCols + visualX)
        const gRow = Math.floor(halfRows - visualY)

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
            camera-target="-8m 12m 78m"
            camera-orbit="180deg 90deg 150m"
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
