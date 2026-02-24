"use client"

import { useRef, useEffect, useCallback, useState } from "react"

// Heatmap color: cold blue -> cyan -> green -> yellow -> white-hot
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridRows: number
  gridCols: number
}

export function OccipitalHeatmap3D({
  matrix,
  gridRows,
  gridCols,
}: OccipitalHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<{
    scene: unknown
    camera: unknown
    renderer: unknown
    controls: unknown
    mesh: unknown
    colors: Float32Array | null
    positions: Float32Array | null
    bounds: {
      minX: number
      maxX: number
      minY: number
      maxY: number
      minZ: number
      maxZ: number
    } | null
    animId: number
    THREE: Record<string, unknown>
  } | null>(null)
  const matrixRef = useRef(matrix)
  const gridRef = useRef({ gridRows, gridCols })
  const [isLoading, setIsLoading] = useState(true)

  matrixRef.current = matrix
  gridRef.current = { gridRows, gridCols }

  const initThree = useCallback(async () => {
    if (!containerRef.current) return

    // Dynamically import Three.js from esm.sh CDN
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let THREE: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let GLTFLoader: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let OrbitControls: any

    try {
      console.log("[v0] Loading Three.js from CDN...")
      THREE = await import(
        /* webpackIgnore: true */
        "https://esm.sh/three@0.172.0"
      )
      console.log("[v0] Three.js loaded, loading GLTFLoader...")
      const loaderModule = await import(
        /* webpackIgnore: true */
        "https://esm.sh/three@0.172.0/examples/jsm/loaders/GLTFLoader.js"
      )
      GLTFLoader = loaderModule.GLTFLoader
      console.log("[v0] GLTFLoader loaded, loading OrbitControls...")
      const controlsModule = await import(
        /* webpackIgnore: true */
        "https://esm.sh/three@0.172.0/examples/jsm/controls/OrbitControls.js"
      )
      OrbitControls = controlsModule.OrbitControls
      console.log("[v0] All Three.js modules loaded successfully")
    } catch (err) {
      console.error("[v0] Failed to load Three.js from CDN:", err)
      setIsLoading(false)
      return
    }

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#060810")

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 10000)
    camera.position.set(0, 0, 2.8)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(5, 5, 5)
    scene.add(dirLight1)
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    dirLight2.position.set(-5, -3, -5)
    scene.add(dirLight2)
    const pointLight = new THREE.PointLight(0x00d2a0, 0.4)
    pointLight.position.set(0, 0, -3)
    scene.add(pointLight)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.01
    controls.maxDistance = 1000

    // Load the brain model
    const loader = new GLTFLoader()
    console.log("[v0] Starting to load brain GLB model...")
    loader.load(
      "/models/full_brain_binary.glb",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gltf: any) => {
        console.log("[v0] Brain GLB loaded, traversing scene...")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let brainGeo: any = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gltf.scene.traverse((child: any) => {
          if (child.isMesh && child.geometry) {
            brainGeo = child.geometry
          }
        })

        if (!brainGeo) {
          console.error("[v0] No mesh found in brain model")
          return
        }

        const positions = brainGeo.getAttribute("position")
        const vertCount = positions.count
        console.log("[v0] Brain mesh found with", vertCount, "vertices")

        // Compute bounds
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity
        for (let i = 0; i < vertCount; i++) {
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

        // Create vertex colors
        const colorsArray = new Float32Array(vertCount * 3)
        for (let i = 0; i < vertCount; i++) {
          colorsArray[i * 3] = 0.22
          colorsArray[i * 3 + 1] = 0.24
          colorsArray[i * 3 + 2] = 0.28
        }
        brainGeo.setAttribute(
          "color",
          new THREE.BufferAttribute(colorsArray, 3)
        )

        // Material with vertex colors
        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.92,
          roughness: 0.6,
          metalness: 0.1,
          side: THREE.DoubleSide,
        })

        const mesh = new THREE.Mesh(brainGeo, material)

        // Center the geometry at the origin
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2
        const centerZ = (minZ + maxZ) / 2
        brainGeo.translate(-centerX, -centerY, -centerZ)

        // Scale to fit nicely in view (~2 units across)
        const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
        const scaleFactor = 2.0 / maxDim
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor)

        scene.add(mesh)

        // V1 target in original model coords: x=-66.89, y=8.88, z=-6.95
        // After centering, these become:
        const v1TargetX = (-66.89 - centerX) * scaleFactor
        const v1TargetY = (8.88 - centerY) * scaleFactor
        const v1TargetZ = (-6.95 - centerZ) * scaleFactor

        console.log("[v0] V1 target in scene coords:", v1TargetX, v1TargetY, v1TargetZ)

        // Point camera at the V1 target from the side (looking along +x toward the left hemisphere occipital)
        controls.target.set(v1TargetX, v1TargetY, v1TargetZ)
        camera.position.set(v1TargetX - 2.5, v1TargetY + 0.5, v1TargetZ)
        camera.lookAt(v1TargetX, v1TargetY, v1TargetZ)
        controls.update()

        console.log("[v0] Brain model centered and scaled. Scale:", scaleFactor, "Center:", centerX, centerY, centerZ)

        // Re-read positions after centering
        const centeredPos = brainGeo.getAttribute("position")
        const posArray = new Float32Array(centeredPos.count * 3)
        for (let i = 0; i < centeredPos.count; i++) {
          posArray[i * 3] = centeredPos.getX(i)
          posArray[i * 3 + 1] = centeredPos.getY(i)
          posArray[i * 3 + 2] = centeredPos.getZ(i)
        }

        // Recompute bounds after centering
        let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity, cMinZ = Infinity, cMaxZ = -Infinity
        for (let i = 0; i < centeredPos.count; i++) {
          const x = posArray[i * 3], y = posArray[i * 3 + 1], z = posArray[i * 3 + 2]
          if (x < cMinX) cMinX = x; if (x > cMaxX) cMaxX = x
          if (y < cMinY) cMinY = y; if (y > cMaxY) cMaxY = y
          if (z < cMinZ) cMinZ = z; if (z > cMaxZ) cMaxZ = z
        }

        console.log("[v0] Centered bounds:", { cMinX, cMaxX, cMinY, cMaxY, cMinZ, cMaxZ })

        threeRef.current = {
          scene,
          camera,
          renderer,
          controls,
          mesh,
          colors: colorsArray,
          positions: posArray,
          bounds: { minX: cMinX, maxX: cMaxX, minY: cMinY, maxY: cMaxY, minZ: cMinZ, maxZ: cMaxZ },
          animId: 0,
          THREE,
        }

        setIsLoading(false)
        animate()
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (progress: any) => {
        if (progress.total) {
          console.log("[v0] Loading brain model:", Math.round((progress.loaded / progress.total) * 100) + "%")
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error: any) => {
        console.error("[v0] Error loading brain model:", error)
        setIsLoading(false)
      }
    )

    function animate() {
      if (!threeRef.current) return
      threeRef.current.animId = requestAnimationFrame(animate)

      // Update vertex colors from the matrix
      updateVertexColors()

      controls.update()
      renderer.render(scene, camera)
    }

    function updateVertexColors() {
      const ref = threeRef.current
      if (
        !ref ||
        !ref.colors ||
        !ref.positions ||
        !ref.bounds ||
        !ref.mesh
      )
        return

      const mat = matrixRef.current
      const { gridRows: gRows, gridCols: gCols } = gridRef.current
      if (mat.length === 0) return

      const { minY, maxY } = ref.bounds
      const yRange = maxY - minY
      const halfRows = gRows / 2
      const halfCols = gCols / 2
      const posArr = ref.positions
      const colArr = ref.colors
      const vertCount = posArr.length / 3

      // V1 target in centered coordinates (pre-computed from original -66.89, 8.88, -6.95)
      // These are the centered coords before scaling -- we work in centered-unscaled space
      // since posArr stores centered-unscaled positions
      const v1CenterX = -66.89 - ((ref.bounds.minX + ref.bounds.maxX) / 2 + 66.89 + ref.bounds.minX) * 0
      // Actually: positions are already centered. The V1 target in model space was (-66.89, 8.88, -6.95).
      // The centering offset was applied to the geometry. posArr has the centered values.
      // The original center was ((minOrig+maxOrig)/2) for each axis.
      // From the inspection: original bounds x[-76,59], y[-56,79], z[-87,85]
      // Original center: x=-8.5, y=11.5, z=-1
      // So V1 in centered space: x = -66.89 - (-8.5) = -58.39, y = 8.88 - 11.5 = -2.62, z = -6.95 - (-1) = -5.95
      const v1X = -58.39
      const v1Y = -2.62
      const v1Z = -5.95
      const v1Radius = 30.0 // radius around V1 center to paint
      const fadeStart = 22.0 // start fading at this distance

      for (let i = 0; i < vertCount; i++) {
        const x = posArr[i * 3]
        const y = posArr[i * 3 + 1]
        const z = posArr[i * 3 + 2]

        const dx = x - v1X
        const dy = y - v1Y
        const dz = z - v1Z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < v1Radius) {
          // Map distance from V1 center to eccentricity (closer = foveal)
          const distNorm = dist / v1Radius
          const logScale = 0.4
          const eccentricity =
            (Math.exp(distNorm / logScale) - 1) /
            (Math.exp(1 / logScale) - 1)
          const maxEcc = Math.sqrt(halfRows * halfRows + halfCols * halfCols)
          const ecc = eccentricity * maxEcc

          // Use y for dorsal/ventral (upper/lower visual field)
          const yMid = (minY + maxY) / 2
          const yNorm = (y - yMid) / (yRange * 0.5)
          const angle = yNorm * Math.PI * 0.4

          // Use z for left/right
          const zNorm = (z - v1Z) / v1Radius

          const visualX = ecc * Math.cos(angle) * Math.sign(zNorm || 1)
          const visualY = ecc * Math.sin(angle)

          const gCol = Math.floor(halfCols + visualX)
          const gRow = Math.floor(halfRows - visualY)

          if (
            gRow >= 0 &&
            gRow < gRows &&
            gCol >= 0 &&
            gCol < gCols &&
            mat[gRow] &&
            mat[gRow][gCol] !== undefined
          ) {
            const value = mat[gRow][gCol]
            const normalized = (value - 2) / 75

            let fade = 1.0
            if (dist > fadeStart) {
              fade = 1.0 - (dist - fadeStart) / (v1Radius - fadeStart)
              fade = fade * fade
            }

            const [r, g, b] = heatColor(normalized)
            colArr[i * 3] = 0.22 + (r - 0.22) * fade
            colArr[i * 3 + 1] = 0.24 + (g - 0.24) * fade
            colArr[i * 3 + 2] = 0.28 + (b - 0.28) * fade
          } else {
            colArr[i * 3] = 0.22
            colArr[i * 3 + 1] = 0.24
            colArr[i * 3 + 2] = 0.28
          }
        } else {
          colArr[i * 3] = 0.22
          colArr[i * 3 + 1] = 0.24
          colArr[i * 3 + 2] = 0.28
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meshObj = ref.mesh as any
      const colorAttr = meshObj.geometry.getAttribute("color")
      if (colorAttr) {
        colorAttr.needsUpdate = true
      }
    }

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cam = threeRef.current.camera as any
      cam.aspect = w / h
      cam.updateProjectionMatrix()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rend = threeRef.current.renderer as any
      rend.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    // Store cleanup info
    return () => {
      resizeObserver.disconnect()
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rend = threeRef.current.renderer as any
        rend.dispose()
        if (rend.domElement && container.contains(rend.domElement)) {
          container.removeChild(rend.domElement)
        }
        threeRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    initThree().then((c) => {
      if (c) cleanup = c
    })
    return () => {
      if (cleanup) cleanup()
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animId)
        threeRef.current = null
      }
    }
  }, [initThree])

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
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810]"
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060810]">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              Loading brain model...
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
          <div
            className="flex-1"
            style={{ background: "rgb(8, 12, 60)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(15, 60, 110)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(20, 180, 170)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(160, 230, 50)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(255, 180, 30)" }}
          />
          <div
            className="flex-1"
            style={{ background: "rgb(255, 245, 220)" }}
          />
        </div>
        <span className="text-[10px]">high stimulus</span>
      </div>
    </div>
  )
}
