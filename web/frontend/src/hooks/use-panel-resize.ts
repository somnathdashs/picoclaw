import { useCallback, useEffect, useRef, useState } from "react"

interface UsePanelResizeOptions {
  minWidth?: number
  maxWidth?: number
  maxScreenPercent?: number
  defaultWidth?: number
  storageKey?: string
}

export function usePanelResize({
  minWidth = 320,
  maxWidth = 1000,
  maxScreenPercent = 55,
  defaultWidth = 440,
  storageKey = "picoclaw_panel_width",
}: UsePanelResizeOptions = {}) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth
    const screenMax = Math.floor(window.innerWidth * (maxScreenPercent / 100))
    const maxAllowed = Math.min(maxWidth, Math.max(minWidth, screenMax))
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && parsed >= minWidth) {
          return Math.min(parsed, maxAllowed)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return Math.min(defaultWidth, maxAllowed)
  })

  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const widthRef = useRef(width)
  const isResizingRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  // Track viewport breakpoint (< 768px is mobile) and clamp width to max screen percent
  useEffect(() => {
    const checkConstraints = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        const screenMax = Math.floor(window.innerWidth * (maxScreenPercent / 100))
        const maxAllowed = Math.min(maxWidth, Math.max(minWidth, screenMax))
        setWidth((prev) => {
          const next = Math.max(minWidth, Math.min(prev, maxAllowed))
          widthRef.current = next
          return next
        })
      }
    }
    checkConstraints()
    window.addEventListener("resize", checkConstraints)
    return () => window.removeEventListener("resize", checkConstraints)
  }, [minWidth, maxWidth, maxScreenPercent])

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    isResizingRef.current = true
  }, [isMobile])

  useEffect(() => {
    if (!isResizing) return

    let pendingWidth = widthRef.current

    const handlePointerMove = (clientX: number) => {
      const screenMax = Math.floor(window.innerWidth * (maxScreenPercent / 100))
      const maxW = Math.min(maxWidth, Math.max(minWidth, screenMax))
      const calculated = window.innerWidth - clientX
      const clamped = Math.max(minWidth, Math.min(maxW, calculated))
      pendingWidth = clamped

      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null
          if (isResizingRef.current) {
            setWidth(pendingWidth)
            widthRef.current = pendingWidth
          }
        })
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX)
      }
    }

    const stopResizing = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      isResizingRef.current = false
      setIsResizing(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""

      try {
        localStorage.setItem(storageKey, String(widthRef.current))
      } catch {
        // Ignore
      }
    }

    document.body.style.cursor = "ew-resize"
    document.body.style.userSelect = "none"

    window.addEventListener("mousemove", onMouseMove, { passive: true })
    window.addEventListener("mouseup", stopResizing)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", stopResizing)

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", stopResizing)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", stopResizing)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, minWidth, maxWidth, maxScreenPercent, storageKey])

  return {
    width: isMobile ? undefined : width,
    isResizing,
    isMobile,
    maxScreenPercent,
    startResizing,
  }
}
