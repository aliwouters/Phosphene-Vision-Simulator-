"use client"

import { useEffect, useRef, useCallback } from "react"

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
        let totalBrightness = 0
        const pixelCount = data.length / 4

        for (let i = 0; i < data.length; i += 4) {
          totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        }

        const avgBrightness = totalBrightness / pixelCount
        const value = Math.round(2 + (avgBrightness / 255) * 75)
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
          className="absolute inset-0 h-full w-full object-cover -scale-x-100"
        />
        <canvas ref={canvasRef} className="hidden" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 h-full w-full object-cover -scale-x-100 pointer-events-none"
        />
        <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 font-mono text-xs text-muted-foreground">
          {gridRows}x{gridCols} grid
        </div>
      </div>
    </div>
  )
}
