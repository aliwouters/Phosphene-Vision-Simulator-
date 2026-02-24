"use client"

import { useRef, useMemo, useEffect, useState } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import * as THREE from "three"

// Heatmap color function: cold blue -> cyan -> green -> yellow -> white-hot
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
    return [lerp(0.08, 0.63, f), lerp(0.71, 0.9, f), lerp(0.67, 0.2, f)]
  }
  if (v < 0.8) {
    const f = (v - 0.6) / 0.2
    return [lerp(0.63, 1.0, f), lerp(0.9, 0.71, f), lerp(0.2, 0.12, f)]
  }
  const f = (v - 0.8) / 0.2
  return [lerp(1.0, 1.0, f), lerp(0.71, 0.96, f), lerp(0.12, 0.86, f)]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface BrainMeshProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

function BrainMesh({ matrix, gridRows, gridCols }: BrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const gltf = useLoader(GLTFLoader, "/models/full_brain_binary.glb")

  // Extract the geometry from the loaded model
  const geometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        geo = child.geometry.clone()
      }
    })
    if (!geo) return new THREE.BufferGeometry()

    // Ensure we have a color attribute
    const positions = (geo as THREE.BufferGeometry).getAttribute("position")
    const colors = new Float32Array(positions.count * 3)
    // Initialize all vertices to a dim base color
    for (let i = 0; i < positions.count; i++) {
      colors[i * 3] = 0.22
      colors[i * 3 + 1] = 0.24
      colors[i * 3 + 2] = 0.28
    }
    ;(geo as THREE.BufferGeometry).setAttribute("color", new THREE.BufferAttribute(colors, 3))

    return geo as THREE.BufferGeometry
  }, [gltf])

  // Compute the bounding box of the occipital region for retinotopic mapping
  const occipitalBounds = useMemo(() => {
    const positions = geometry.getAttribute("position")
    if (!positions) return null

    // From our inspection: x[-76, 59], y[-56, 79], z[-87, 85]
    // The occipital lobe is at the posterior end.
    // We need to figure out which axis is posterior.
    // z min=-87, max=85 -> posterior is likely z < -30 (negative z)
    let minZ = Infinity, maxZ = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minX = Infinity, maxX = -Infinity

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }

    return { minX, maxX, minY, maxY, minZ, maxZ }
  }, [geometry])

  // Update vertex colors based on the brightness matrix
  useFrame(() => {
    if (!meshRef.current || !occipitalBounds || matrix.length === 0) return

    const geo = meshRef.current.geometry
    const positions = geo.getAttribute("position")
    const colors = geo.getAttribute("color")
    if (!positions || !colors) return

    const { minX, maxX, minY, maxY, minZ, maxZ } = occipitalBounds
    const zRange = maxZ - minZ
    const yRange = maxY - minY
    const xRange = maxX - minX

    // Occipital lobe: posterior ~30% of the brain (z axis)
    // We use a soft boundary with gradient falloff
    const occipitalThresholdZ = minZ + zRange * 0.35
    const fadeStartZ = minZ + zRange * 0.28

    const halfRows = gridRows / 2
    const halfCols = gridCols / 2

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)

      // Check if this vertex is in the occipital region
      if (z < occipitalThresholdZ) {
        // Map vertex position to visual field coordinates using retinotopic mapping
        // z -> eccentricity (posterior pole = fovea, anterior boundary = periphery)
        const zNorm = 1.0 - (z - minZ) / (occipitalThresholdZ - minZ) // 0=anterior, 1=posterior pole

        // Log-polar eccentricity mapping
        const logScale = 0.4
        const eccentricity = (Math.exp(zNorm / logScale) - 1) / (Math.exp(1 / logScale) - 1)
        const maxEcc = Math.sqrt(halfRows * halfRows + halfCols * halfCols)
        const ecc = eccentricity * maxEcc

        // y -> polar angle (dorsal-ventral mapping)
        // Dorsal (top, y > midpoint) = lower visual field
        // Ventral (bottom, y < midpoint) = upper visual field
        const yMid = (minY + maxY) / 2
        const yNorm = (y - yMid) / (yRange * 0.5) // -1 to 1
        const angle = yNorm * Math.PI * 0.4

        // x -> left-right in visual field
        const xMid = (minX + maxX) / 2
        const xNorm = (x - xMid) / (xRange * 0.5) // -1 to 1

        // Combine into grid coordinates
        const visualX = ecc * Math.cos(angle) * Math.sign(xNorm || 1)
        const visualY = ecc * Math.sin(angle)

        const gCol = Math.floor(halfCols + visualX)
        const gRow = Math.floor(halfRows - visualY)

        if (
          gRow >= 0 && gRow < gridRows &&
          gCol >= 0 && gCol < gridCols &&
          matrix[gRow] && matrix[gRow][gCol] !== undefined
        ) {
          const value = matrix[gRow][gCol]
          const normalized = (value - 2) / 75

          // Fade factor for the boundary between occipital and rest of brain
          let fade = 1.0
          if (z > fadeStartZ) {
            fade = 1.0 - (z - fadeStartZ) / (occipitalThresholdZ - fadeStartZ)
            fade = fade * fade // smooth falloff
          }

          const [r, g, b] = heatColor(normalized)
          colors.setXYZ(
            i,
            0.22 + (r - 0.22) * fade,
            0.24 + (g - 0.24) * fade,
            0.28 + (b - 0.28) * fade
          )
        } else {
          colors.setXYZ(i, 0.22, 0.24, 0.28)
        }
      } else {
        // Non-occipital: dim base color
        colors.setXYZ(i, 0.22, 0.24, 0.28)
      }
    }

    colors.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={geometry} scale={0.015}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.92}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

export function OccipitalHeatmap3D({ matrix, gridRows, gridCols }: OccipitalHeatmapProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-primary">
          Occipital Cortex Map (3D)
        </h2>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810]">
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 45, near: 0.01, far: 100 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={() => setIsLoaded(true)}
        >
          <color attach="background" args={["#060810"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-5, -3, -5]} intensity={0.3} />
          <pointLight position={[0, 0, -3]} intensity={0.4} color="#00d2a0" />

          <BrainMesh matrix={matrix} gridRows={gridRows} gridCols={gridCols} />

          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={0.5}
            maxDistance={6}
            autoRotate={false}
          />
        </Canvas>

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#060810]">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              Loading brain model...
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
          drag to rotate / scroll to zoom / right-click to pan
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
