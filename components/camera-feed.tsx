"use client"

import { useEffect, useRef, useCallback } from "react"
import { LearnMore } from "./learn-more"
import { lumaFromRgb, pixelLumaToNormalizedIntensity, toDisplayIntensity } from "@/lib/phosphene"

interface CameraFeedProps {
  gridRows: number
  gridCols: number
  onMatrixUpdate: (matrix: number[][]) => void
}

export function CameraFeed({ gridRows, gridCols, onMatrixUpdate }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const processFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (!video || !canvas || !overlayCanvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const overlayCtx = overlayCanvas.getContext("2d")
    if (!ctx || !overlayCtx) {
      animationRef.current = requestAnimationFrame(processFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    overlayCanvas.width = video.videoWidth
    overlayCanvas.height = video.videoHeight

    ctx.drawImage(video, 0, 0)

    const cellW = video.videoWidth / gridCols
    const cellH = video.videoHeight / gridRows
    const matrix: number[][] = []

    for (let row = 0; row < gridRows; row++) {
      const rowValues: number[] = []
      for (let col = 0; col < gridCols; col++) {
        const x = Math.floor(col * cellW)
        const y = Math.floor(row * cellH)
        const w = Math.floor(cellW)
        const h = Math.floor(cellH)

        const imageData = ctx.getImageData(x, y, w, h)
        const data = imageData.data
        let totalLuma = 0
        const pixelCount = data.length / 4

        for (let i = 0; i < data.length; i += 4) {
          totalLuma += lumaFromRgb(data[i], data[i + 1], data[i + 2])
        }

        // Camera pixel luma (0-255) -> normalized stimulation intensity (0-1)
        // -> integer display index (0-100). See lib/phosphene.ts for why these
        // are distinct quantities and are NOT electrical current.
        const avgLuma = totalLuma / pixelCount
        const value = toDisplayIntensity(pixelLumaToNormalizedIntensity(avgLuma))
        rowValues.push(value)
      }
      matrix.push(rowValues)
    }

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    overlayCtx.strokeStyle = "rgba(0, 210, 160, 0.25)"
    overlayCtx.lineWidth = 1

    for (let i = 1; i < gridCols; i++) {
      const x = Math.floor(i * cellW)
      overlayCtx.beginPath()
      overlayCtx.moveTo(x, 0)
      overlayCtx.lineTo(x, overlayCanvas.height)
      overlayCtx.stroke()
    }

    for (let i = 1; i < gridRows; i++) {
      const y = Math.floor(i * cellH)
      overlayCtx.beginPath()
      overlayCtx.moveTo(0, y)
      overlayCtx.lineTo(overlayCanvas.width, y)
      overlayCtx.stroke()
    }

    onMatrixUpdate(matrix)
    animationRef.current = requestAnimationFrame(processFrame)
  }, [gridRows, gridCols, onMatrixUpdate])

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        // Camera access denied or unavailable
      }
    }

    startCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    animationRef.current = requestAnimationFrame(processFrame)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [processFrame])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <h2 className="text-sm font-mono font-medium tracking-wider uppercase text-primary">
          Camera Feed
        </h2>
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onPlay={() => {
            if (!animationRef.current) {
              animationRef.current = requestAnimationFrame(processFrame)
            }
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{gridRows}x{gridCols} grid</span>
      </div>
      <LearnMore>
        <p className="mb-1.5">
          <span className="text-primary">Illustrative.</span> In head-mounted visual
          prostheses, a camera on a pair of glasses captures the scene in real time and
          an external processor converts it into stimulation commands. Here we use your
          device camera to stand in for that input.
        </p>
        <p>
          The overlaid grid shows how the frame is divided into cells. Each cell&apos;s
          average brightness (Rec. 601 luma) becomes one stimulation value. The feed is
          shown un-mirrored (world-facing, like a real prosthesis camera) so that the
          left and right of the scene line up with the left and right of the visual field
          in the maps below.
        </p>
      </LearnMore>
    </div>
  )
}
