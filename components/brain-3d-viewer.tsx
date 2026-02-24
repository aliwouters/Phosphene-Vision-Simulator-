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

    // Dynamically import Three.js from CDN via importmap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let THREE: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let GLTFLoader: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let OrbitControls: any

    try {
      THREE = await import(
        /* webpackIgnore: true */
        "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.min.js"
      )
      const loaderModule = await import(
        /* webpackIgnore: true */
        "https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/loaders/GLTFLoader.js"
      )
      GLTFLoader = loaderModule.GLTFLoader
      const controlsModule = await import(
        /* webpackIgnore: true */
        "https://cdn.jsdelivr.net/npm/three@0.172.0/examples/jsm/controls/OrbitControls.js"
      )
      OrbitControls = controlsModule.OrbitControls
    } catch {
      console.error("[v0] Failed to load Three.js from CDN")
      return
    }

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#060810")

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100)
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
    controls.minDistance = 0.5
    controls.maxDistance = 6

    // Load the brain model
    const loader = new GLTFLoader()
    loader.load(
      "/models/full_brain_binary.glb",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gltf: any) => {
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
        mesh.scale.set(0.015, 0.015, 0.015)
        scene.add(mesh)

        threeRef.current = {
          scene,
          camera,
          renderer,
          controls,
          mesh,
          colors: colorsArray,
          positions: new Float32Array(
            positions.array.buffer.slice(
              positions.array.byteOffset,
              positions.array.byteOffset +
                positions.array.byteLength
            )
          ),
          bounds: { minX, maxX, minY, maxY, minZ, maxZ },
          animId: 0,
          THREE,
        }

        setIsLoading(false)
        animate()
      },
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error: any) => {
        console.error("[v0] Error loading brain model:", error)
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

      const { minX, maxX, minY, maxY, minZ, maxZ } = ref.bounds
      const zRange = maxZ - minZ
      const yRange = maxY - minY
      const xRange = maxX - minX
      const occThreshZ = minZ + zRange * 0.35
      const fadeStartZ = minZ + zRange * 0.28
      const halfRows = gRows / 2
      const halfCols = gCols / 2
      const posArr = ref.positions
      const colArr = ref.colors
      const vertCount = posArr.length / 3

      for (let i = 0; i < vertCount; i++) {
        const x = posArr[i * 3]
        const y = posArr[i * 3 + 1]
        const z = posArr[i * 3 + 2]

        if (z < occThreshZ) {
          const zNorm =
            1.0 - (z - minZ) / (occThreshZ - minZ)
          const logScale = 0.4
          const eccentricity =
            (Math.exp(zNorm / logScale) - 1) /
            (Math.exp(1 / logScale) - 1)
          const maxEcc = Math.sqrt(
            halfRows * halfRows + halfCols * halfCols
          )
          const ecc = eccentricity * maxEcc

          const yMid = (minY + maxY) / 2
          const yNorm = (y - yMid) / (yRange * 0.5)
          const angle = yNorm * Math.PI * 0.4

          const xMid = (minX + maxX) / 2
          const xNorm = (x - xMid) / (xRange * 0.5)

          const visualX =
            ecc * Math.cos(angle) * Math.sign(xNorm || 1)
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
            if (z > fadeStartZ) {
              fade =
                1.0 -
                (z - fadeStartZ) / (occThreshZ - fadeStartZ)
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
