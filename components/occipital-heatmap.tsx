"use client"

import { useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text, Environment } from "@react-three/drei"
import * as THREE from "three"

interface OccipitalHeatmapProps {
  matrix: number[][]
  gridSize: number
}

// Heat color: dark blue -> cyan -> green -> yellow -> orange -> white
function heatColor(t: number): THREE.Color {
  const v = Math.max(0, Math.min(1, t))
  if (v < 0.2) {
    return new THREE.Color().lerpColors(
      new THREE.Color(0x050830),
      new THREE.Color(0x0a4060),
      v / 0.2
    )
  }
  if (v < 0.4) {
    return new THREE.Color().lerpColors(
      new THREE.Color(0x0a4060),
      new THREE.Color(0x0dbaa0),
      (v - 0.2) / 0.2
    )
  }
  if (v < 0.6) {
    return new THREE.Color().lerpColors(
      new THREE.Color(0x0dbaa0),
      new THREE.Color(0xa0e830),
      (v - 0.4) / 0.2
    )
  }
  if (v < 0.8) {
    return new THREE.Color().lerpColors(
      new THREE.Color(0xa0e830),
      new THREE.Color(0xffa020),
      (v - 0.6) / 0.2
    )
  }
  return new THREE.Color().lerpColors(
    new THREE.Color(0xffa020),
    new THREE.Color(0xfff0e0),
    (v - 0.8) / 0.2
  )
}

// Generate brain hemisphere geometry (medial surface approximation)
function createBrainGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()

  // Medial sagittal brain profile (viewed from the side)
  // Coordinates in a ~4x3 bounding box centered roughly at origin
  // Front is -x, back (occipital) is +x

  // Start at frontal pole
  shape.moveTo(-2.0, -0.1)

  // Frontal lobe upper curve
  shape.bezierCurveTo(-1.8, 1.2, -0.8, 1.7, 0.0, 1.6)

  // Parietal lobe
  shape.bezierCurveTo(0.7, 1.5, 1.3, 1.2, 1.7, 0.7)

  // Occipital pole
  shape.bezierCurveTo(2.0, 0.3, 2.0, -0.3, 1.7, -0.6)

  // Inferior occipital / cerebellum boundary
  shape.bezierCurveTo(1.3, -1.0, 0.8, -1.1, 0.3, -1.0)

  // Temporal lobe / brain stem
  shape.bezierCurveTo(-0.3, -0.9, -1.0, -1.0, -1.5, -0.7)

  // Back to frontal pole
  shape.bezierCurveTo(-1.8, -0.5, -2.0, -0.3, -2.0, -0.1)

  // Extrude to give it 3D depth
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 1.2,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.2,
    bevelOffset: 0,
    bevelSegments: 8,
    curveSegments: 32,
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.center()

  return geometry
}

// Generate occipital lobe region geometry (the V1 area along calcarine)
function createOccipitalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()

  // Occipital region -- the posterior wedge of the brain
  shape.moveTo(0.6, 0.0)

  // Dorsal bank
  shape.bezierCurveTo(0.8, 0.6, 1.3, 0.9, 1.7, 0.7)

  // Posterior pole
  shape.bezierCurveTo(2.0, 0.3, 2.0, -0.3, 1.7, -0.6)

  // Ventral bank
  shape.bezierCurveTo(1.3, -0.85, 0.8, -0.6, 0.6, 0.0)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 1.3,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.1,
    bevelOffset: 0,
    bevelSegments: 6,
    curveSegments: 32,
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.center()

  return geometry
}

// Create the calcarine sulcus line
function CalcarineSulcus() {
  const points = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.65, 0.0, 0.0),
      new THREE.Vector3(-0.2, 0.02, 0.0),
      new THREE.Vector3(0.2, -0.02, 0.0),
      new THREE.Vector3(0.65, 0.0, 0.0)
    )
    return curve.getPoints(40)
  }, [])

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineDashedMaterial
        color="#ffffff"
        dashSize={0.05}
        gapSize={0.03}
        opacity={0.6}
        transparent
      />
    </line>
  )
}

// The heatmap surface textured with the matrix data
function HeatmapTexture({
  matrix,
  gridSize,
}: {
  matrix: number[][]
  gridSize: number
}) {
  const textureRef = useRef<THREE.DataTexture | null>(null)

  const texture = useMemo(() => {
    const size = 128
    const data = new Uint8Array(size * size * 4)

    // Fill with dark blue initially
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = 5
      data[i * 4 + 1] = 8
      data[i * 4 + 2] = 48
      data[i * 4 + 3] = 255
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.needsUpdate = true
    textureRef.current = tex
    return tex
  }, [])

  // Update texture when matrix changes
  useEffect(() => {
    if (!textureRef.current || matrix.length === 0) return

    const tex = textureRef.current
    const size = 128
    const data = tex.image.data as Uint8Array
    const halfGrid = gridSize / 2

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const idx = (py * size + px) * 4

        // Map texture coordinates to the occipital V1 region
        // The texture is applied to the occipital geometry
        // U (px) = anterior-posterior axis (left = anterior/periphery, right = posterior/fovea)
        // V (py) = dorsal-ventral axis (bottom = ventral/upper field, top = dorsal/lower field)

        const u = px / size
        const v = py / size

        // Log-polar mapping: simulate cortical magnification
        // Posterior pole (u=1) = fovea (center of visual field)
        // Anterior (u=0) = periphery
        const logScale = 0.4
        const eccentricity = (Math.exp((1 - u) / logScale) - 1) / (Math.exp(1 / logScale) - 1)
        const maxEcc = halfGrid * Math.sqrt(2)
        const ecc = eccentricity * maxEcc

        // Angle from calcarine: v=0.5 is the calcarine sulcus (horizontal meridian)
        // v>0.5 = dorsal = lower visual field, v<0.5 = ventral = upper visual field
        const angle = (v - 0.5) * Math.PI * 0.85

        const visualX = ecc * Math.cos(angle)
        const visualY = ecc * Math.sin(angle)

        const gridCol = Math.floor(halfGrid + visualX)
        const gridRow = Math.floor(halfGrid - visualY) // flip Y

        if (
          gridRow >= 0 &&
          gridRow < gridSize &&
          gridCol >= 0 &&
          gridCol < gridSize &&
          matrix[gridRow] &&
          matrix[gridRow][gridCol] !== undefined
        ) {
          const value = matrix[gridRow][gridCol]
          const normalized = (value - 2) / 75
          const color = heatColor(normalized)
          data[idx] = Math.round(color.r * 255)
          data[idx + 1] = Math.round(color.g * 255)
          data[idx + 2] = Math.round(color.b * 255)
          data[idx + 3] = 255
        } else {
          data[idx] = 5
          data[idx + 1] = 8
          data[idx + 2] = 48
          data[idx + 3] = 255
        }
      }
    }

    tex.needsUpdate = true
  }, [matrix, gridSize])

  return texture
}

// Main brain mesh component
function BrainModel({
  matrix,
  gridSize,
}: {
  matrix: number[][]
  gridSize: number
}) {
  const brainRef = useRef<THREE.Mesh>(null!)
  const occipitalRef = useRef<THREE.Mesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)

  const brainGeometry = useMemo(() => createBrainGeometry(), [])
  const occipitalGeometry = useMemo(() => createOccipitalGeometry(), [])
  const heatmapTexture = HeatmapTexture({ matrix, gridSize })

  // Gentle idle rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.15) * 0.08 - 0.3
    }
  })

  return (
    <group ref={groupRef} rotation={[0, -0.3, 0]}>
      {/* Brain hemisphere -- translucent */}
      <mesh ref={brainRef} geometry={brainGeometry}>
        <meshPhysicalMaterial
          color="#1a1e30"
          transparent
          opacity={0.35}
          roughness={0.7}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Brain wireframe overlay for sulci texture */}
      <mesh geometry={brainGeometry}>
        <meshBasicMaterial
          color="#2a3050"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Occipital lobe with heatmap */}
      <mesh ref={occipitalRef} geometry={occipitalGeometry}>
        <meshStandardMaterial
          map={heatmapTexture}
          emissiveMap={heatmapTexture}
          emissive="#ffffff"
          emissiveIntensity={0.5}
          roughness={0.5}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Occipital lobe border glow */}
      <mesh geometry={occipitalGeometry} scale={[1.02, 1.02, 1.02]}>
        <meshBasicMaterial
          color="#00d2a0"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Calcarine sulcus */}
      <group position={[0.05, 0.0, 0.0]}>
        <CalcarineSulcus />
      </group>

      {/* Labels */}
      <Text
        position={[-1.2, 1.0, 0.7]}
        fontSize={0.15}
        color="#556070"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        FRONTAL
      </Text>
      <Text
        position={[0.3, 1.3, 0.7]}
        fontSize={0.15}
        color="#556070"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        PARIETAL
      </Text>
      <Text
        position={[-0.5, -0.85, 0.7]}
        fontSize={0.15}
        color="#556070"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        TEMPORAL
      </Text>
      <Text
        position={[1.1, -0.0, 0.75]}
        fontSize={0.16}
        color="#00d2a0"
        font="/fonts/GeistMono-Bold.ttf"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        V1
      </Text>

      {/* Dorsal / Ventral labels */}
      <Text
        position={[1.1, 0.65, 0.75]}
        fontSize={0.1}
        color="#00d2a0"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        DORSAL (lower field)
      </Text>
      <Text
        position={[1.1, -0.6, 0.75]}
        fontSize={0.1}
        color="#00d2a0"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        VENTRAL (upper field)
      </Text>

      {/* Posterior / Anterior */}
      <Text
        position={[1.85, -0.15, 0.75]}
        fontSize={0.08}
        color="#00d2a088"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {"POSTERIOR\n(fovea)"}
      </Text>
      <Text
        position={[0.15, -0.15, 0.75]}
        fontSize={0.08}
        color="#00d2a088"
        font="/fonts/GeistMono-Regular.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {"ANTERIOR\n(periphery)"}
      </Text>

      {/* Fovea marker at posterior pole */}
      <mesh position={[1.62, 0.0, 0.65]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[1.62, 0.0, 0.65]}>
        <ringGeometry args={[0.06, 0.08, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function OccipitalHeatmap({ matrix, gridSize }: OccipitalHeatmapProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Occipital Cortex Map
        </h2>
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-[#060810]">
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 40 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: "#060810" }}
        >
          <color attach="background" args={["#060810"]} />

          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 3, 5]} intensity={0.8} />
          <directionalLight position={[-2, -1, 3]} intensity={0.3} />
          <pointLight position={[2, 0, 3]} intensity={0.6} color="#00d2a0" />

          <BrainModel matrix={matrix} gridSize={gridSize} />

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2.5}
            maxDistance={8}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
            autoRotate={false}
          />
        </Canvas>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="text-[10px]">low stimulus</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-sm">
          <div className="flex-1" style={{ background: "rgb(5, 8, 48)" }} />
          <div className="flex-1" style={{ background: "rgb(10, 64, 96)" }} />
          <div className="flex-1" style={{ background: "rgb(13, 186, 160)" }} />
          <div className="flex-1" style={{ background: "rgb(160, 232, 48)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 160, 32)" }} />
          <div className="flex-1" style={{ background: "rgb(255, 240, 224)" }} />
        </div>
        <span className="text-[10px]">high stimulus</span>
      </div>
    </div>
  )
}
