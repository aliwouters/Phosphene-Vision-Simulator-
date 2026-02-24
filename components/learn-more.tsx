"use client"

import { useState, useRef, useEffect } from "react"

interface LearnMoreProps {
  children: React.ReactNode
  step?: number
}

export function LearnMore({ children, step }: LearnMoreProps) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [open])

  return (
    <div className="relative mt-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group relative flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-all hover:border-border hover:bg-card/60"
        aria-expanded={open}
      >
        {step !== undefined && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[9px] font-medium text-primary">
            {step}
          </span>
        )}
        <span className="flex-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
          {open ? "Hide details" : "How it works"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-primary ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? height : 0, opacity: open ? 1 : 0 }}
      >
        <div
          ref={contentRef}
          className="relative mt-1 rounded-md border border-border/60 bg-card/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm"
        >
          <div className="absolute left-0 top-0 h-full w-[2px] rounded-full bg-primary/30" />
          <div className="pl-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
