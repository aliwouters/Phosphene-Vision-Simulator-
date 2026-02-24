"use client"

import { useState, useRef, useEffect } from "react"

interface LearnMoreProps {
  children: React.ReactNode
}

export function LearnMore({ children }: LearnMoreProps) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
        aria-expanded={open}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M8 7v4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="8" cy="5" r="0.8" fill="currentColor" />
        </svg>
        {open ? "close" : "learn more"}
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? height + 16 : 0, opacity: open ? 1 : 0 }}
      >
        <div
          ref={contentRef}
          className="mt-2 mb-1 rounded-md border border-border bg-card/80 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
