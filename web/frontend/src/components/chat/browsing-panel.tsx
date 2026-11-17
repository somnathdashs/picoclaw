import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCopy,
  IconExternalLink,
  IconLock,
  IconPhoto,
  IconRefresh,
  IconShieldCheck,
  IconVideo,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AgentBrowserActivity } from "@/features/chat/agent-browser-tracker"
import { usePanelResize } from "@/hooks/use-panel-resize"

interface BrowsingPanelProps {
  onClose: () => void
  agentActivity?: AgentBrowserActivity
}

interface ClickEffect {
  id: string
  x: number
  y: number
  label?: string
  isAgent?: boolean
}

type ViewMode = "auto" | "stream" | "web" | "snapshot"

export function BrowsingPanel({ onClose, agentActivity }: BrowsingPanelProps) {
  const { t } = useTranslation()
  const { width, isResizing, isMobile, startResizing } = usePanelResize({
    storageKey: "picoclaw_browsing_panel_width",
    defaultWidth: 540,
    maxScreenPercent: 80,
  })

  const [currentUrl, setCurrentUrl] = useState<string>(() => agentActivity?.activeUrl || "")
  const [inputUrl, setInputUrl] = useState<string>(() => agentActivity?.activeUrl || "")
  const [history, setHistory] = useState<string[]>(() => (agentActivity?.activeUrl ? [agentActivity.activeUrl] : []))
  const [historyIndex, setHistoryIndex] = useState(0)
  const [iframeKey, setIframeKey] = useState(0)
  const [isIframeLoading, setIsIframeLoading] = useState(false)
  const [iframeBlocked, setIframeBlocked] = useState(false)
  const [useGatewayProxy, setUseGatewayProxy] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [clicks, setClicks] = useState<ClickEffect[]>([])

  // Official agent-browser live screencast state
  const [streamConnected, setStreamConnected] = useState(false)
  const [streamFrame, setStreamFrame] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("auto")

  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastHandledStepId = useRef<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Sync active URL from agent actions
  useEffect(() => {
    if (agentActivity?.activeUrl && agentActivity.activeUrl !== currentUrl) {
      setCurrentUrl(agentActivity.activeUrl)
      setInputUrl(agentActivity.activeUrl)
      setHistory((prev) => [...prev, agentActivity.activeUrl])
      setHistoryIndex((prev) => prev + 1)
      setIframeBlocked(false)
      setIsIframeLoading(true)
    }
  }, [agentActivity?.activeUrl])

  // Connect to official agent-browser WebSocket stream when daemon is running
  useEffect(() => {
    const port = agentActivity?.streamPort || 9223
    let ws: WebSocket | null = null
    let isCancelled = false

    try {
      ws = new WebSocket(`ws://127.0.0.1:${port}`)

      ws.onopen = () => {
        if (isCancelled) return
        setStreamConnected(true)
        ws?.send(JSON.stringify({ type: "config", pacing: "ack", maxFps: 15 }))
      }

      ws.onmessage = (event) => {
        if (isCancelled) return
        try {
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data)
            if (data.type === "frame" && data.data) {
              const src = data.data.startsWith("data:") ? data.data : `data:image/jpeg;base64,${data.data}`
              setStreamFrame(src)
              if (typeof data.seq === "number") {
                ws?.send(JSON.stringify({ type: "ack", seq: data.seq }))
              }
            } else if (data.type === "url" && data.url) {
              setCurrentUrl(data.url)
              setInputUrl(data.url)
            }
          }
        } catch (_) {}
      }

      ws.onerror = () => {
        if (!isCancelled) setStreamConnected(false)
      }

      ws.onclose = () => {
        if (!isCancelled) setStreamConnected(false)
      }

      wsRef.current = ws
    } catch (_) {
      setStreamConnected(false)
    }

    return () => {
      isCancelled = true
      if (ws) ws.close()
    }
  }, [agentActivity?.streamPort])

  // Auto-dismiss stuck loading states after 4 seconds
  useEffect(() => {
    if (!isIframeLoading) return
    const timer = setTimeout(() => {
      setIsIframeLoading(false)
    }, 4000)
    return () => clearTimeout(timer)
  }, [isIframeLoading])

  // Trigger click animation effect
  const triggerClickAnimation = useCallback((click: Omit<ClickEffect, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setClicks((prev) => [...prev.slice(-6), { ...click, id }])
    setTimeout(() => {
      setClicks((prev) => prev.filter((c) => c.id !== id))
    }, 1300)
  }, [])

  // Animate agent clicks when agent control dispatches click actions
  useEffect(() => {
    const step = agentActivity?.lastStep
    if (!step || step.id === lastHandledStepId.current) return
    lastHandledStepId.current = step.id

    if (step.action === "click" || step.command.toLowerCase().includes("click")) {
      const el = agentActivity.elements.find((e) => e.ref === step.ref)
      const label = el ? `${el.ref} [${el.tag}] ${el.label || ""}`.trim() : (step.ref || "Agent Click")
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        triggerClickAnimation({
          x: Math.max(25, rect.width / 2 + (Math.random() * 80 - 40)),
          y: Math.max(50, rect.height / 2 + (Math.random() * 80 - 40)),
          label,
          isAgent: true,
        })
      }
    }
  }, [agentActivity?.lastStep, agentActivity?.elements, triggerClickAnimation])

  // Relay mouse clicks to agent-browser daemon over WebSocket
  const handleStreamClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = (e.currentTarget.naturalWidth || rect.width) / rect.width
    const scaleY = (e.currentTarget.naturalHeight || rect.height) / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)

    wsRef.current.send(JSON.stringify({
      type: "input_mouse",
      eventType: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }))
    setTimeout(() => {
      wsRef.current?.send(JSON.stringify({
        type: "input_mouse",
        eventType: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }))
    }, 50)
  }

  // Capture clicks inside proxied iframe via postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "agy-browser-click" && iframeRef.current && containerRef.current) {
        const ifrRect = iframeRef.current.getBoundingClientRect()
        const contRect = containerRef.current.getBoundingClientRect()
        const scaleX = ifrRect.width / (iframeRef.current.clientWidth || ifrRect.width || 1)
        const scaleY = ifrRect.height / (iframeRef.current.clientHeight || ifrRect.height || 1)
        const x = (ifrRect.left - contRect.left) + (Number(e.data.clientX || 0) * scaleX)
        const y = (ifrRect.top - contRect.top) + (Number(e.data.clientY || 0) * scaleY)
        triggerClickAnimation({
          x: Math.max(10, x),
          y: Math.max(10, y),
          label: e.data.targetText || e.data.targetTag || "Click",
          isAgent: false,
        })
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [triggerClickAnimation])

  const proxiedIframeSrc = useMemo(() => {
    if (!currentUrl) return ""
    if (!useGatewayProxy) return currentUrl
    return `/api/proxy/browse?url=${encodeURIComponent(currentUrl)}`
  }, [currentUrl, useGatewayProxy])

  const navigateTo = useCallback((url: string) => {
    let clean = url.trim()
    if (!clean) return
    if (!/^https?:\/\//i.test(clean) && !clean.startsWith("/")) {
      clean = `https://${clean}`
    }
    setCurrentUrl(clean)
    setInputUrl(clean)
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), clean])
    setHistoryIndex((prev) => prev + 1)
    setIframeBlocked(false)
    setIsIframeLoading(true)
    setViewMode("web")
  }, [historyIndex])

  const handleBack = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]
      setHistoryIndex((i) => i - 1)
      setCurrentUrl(prev)
      setInputUrl(prev)
      setIframeBlocked(false)
    }
  }

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]
      setHistoryIndex((i) => i + 1)
      setCurrentUrl(next)
      setInputUrl(next)
      setIframeBlocked(false)
    }
  }

  const handleReload = () => {
    setIframeKey((k) => k + 1)
    setIframeBlocked(false)
    setIsIframeLoading(true)
  }

  const handleCopyUrl = async () => {
    if (!currentUrl) return
    try {
      await navigator.clipboard.writeText(currentUrl)
      toast.success(t("chat.copiedLabel", "Copied to clipboard"))
    } catch {
      toast.error("Failed to copy URL")
    }
  }

  const isAgentControlling = Boolean(agentActivity?.isBrowsingActive)
  const effectiveWidth = isMaximized ? "94vw" : !isMobile && width ? `${width}px` : undefined

  // Determine active view mode
  const effectiveMode = useMemo(() => {
    if (viewMode !== "auto") return viewMode
    if (streamConnected && streamFrame) return "stream"
    if (agentActivity?.screenshotUrl) return "snapshot"
    return "web"
  }, [viewMode, streamConnected, streamFrame, agentActivity?.screenshotUrl])

  return (
    <aside
      style={effectiveWidth ? { width: effectiveWidth } : undefined}
      className={`w-full shrink-0 border-l border-border bg-card flex flex-col h-full z-30 absolute inset-0 md:static ${
        isResizing ? "select-none transition-none" : "transition-all duration-200"
      } shadow-2xl md:shadow-none animate-in fade-in slide-in-from-right-4 relative max-w-full`}
    >
      <style>{`
        @keyframes agy-click-ripple {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          50% { opacity: 0.85; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0; }
        }
        @keyframes agy-cursor-bounce {
          0% { transform: scale(0.6) translate(-4px, -4px); }
          50% { transform: scale(1.2) translate(1px, 1px); }
          100% { transform: scale(1) translate(0, 0); }
        }
      `}</style>

      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-ew-resize select-none pointer-events-auto" />
      )}

      {/* Drag handle */}
      <div
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        className="hidden md:block absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize z-40 group"
        title="Drag to resize panel"
      >
        <div className="w-1 h-full mx-auto transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
      </div>

      {/* Top Header */}
      <div className="p-2 sm:p-2.5 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IconWorld className="size-4" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs sm:text-sm font-semibold truncate text-foreground leading-tight">
              Browser
            </span>
            {streamConnected ? (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-700 gap-1 text-white">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                Live Screencast
              </Badge>
            ) : isAgentControlling ? (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500 hover:bg-emerald-600 gap-1 animate-pulse">
                <span className="size-1.5 rounded-full bg-white" />
                AI Browsing
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground border-border/60">
                Interactive
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mode switch pills if stream or snapshot available */}
          {(streamConnected || agentActivity?.screenshotUrl) && (
            <div className="flex items-center border border-border/60 rounded-md p-0.5 bg-muted/30 text-xs">
              {streamConnected && (
                <button
                  type="button"
                  onClick={() => setViewMode("stream")}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                    effectiveMode === "stream" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Official agent-browser Live Stream"
                >
                  <IconVideo className="size-3" />
                  Stream
                </button>
              )}
              {agentActivity?.screenshotUrl && (
                <button
                  type="button"
                  onClick={() => setViewMode("snapshot")}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                    effectiveMode === "snapshot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Agent Screenshot View"
                >
                  <IconPhoto className="size-3" />
                  Snapshot
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode("web")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  effectiveMode === "web" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Interactive Web View"
              >
                <IconWorld className="size-3" />
                Web
              </button>
            </div>
          )}

          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => window.open(currentUrl, "_blank", "noopener,noreferrer")}
              title="Open in new window"
            >
              <IconExternalLink className="size-3.5" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex size-7 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMaximized((prev) => !prev)}
            title={isMaximized ? "Restore width" : "Maximize panel"}
          >
            {isMaximized ? (
              <IconArrowsMinimize className="size-3.5" />
            ) : (
              <IconArrowsMaximize className="size-3.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={onClose}
            title="Close browser panel"
          >
            <IconX className="size-4" />
          </Button>
        </div>
      </div>

      {/* Navigation & Address Bar */}
      <div className="px-2 py-1.5 border-b border-border/50 bg-muted/15 flex items-center gap-1 shrink-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={historyIndex <= 0}
            onClick={handleBack}
            className="size-7 p-0 text-muted-foreground disabled:opacity-30"
            title="Back"
          >
            <IconArrowLeft className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={historyIndex >= history.length - 1}
            onClick={handleForward}
            className="size-7 p-0 text-muted-foreground disabled:opacity-30"
            title="Forward"
          >
            <IconArrowRight className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReload}
            className="size-7 p-0 text-muted-foreground"
            title="Reload"
          >
            <IconRefresh className={`size-3.5 ${isIframeLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            navigateTo(inputUrl)
          }}
          className="flex-1 min-w-[120px] flex items-center relative"
        >
          <Input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter website URL (e.g. https://...)"
            className="h-7 text-xs pr-7 font-mono bg-background/80"
          />
          {currentUrl && (
            <button
              type="button"
              onClick={handleCopyUrl}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              title="Copy URL"
            >
              <IconCopy className="size-3" />
            </button>
          )}
        </form>

        <Button
          type="button"
          size="sm"
          onClick={() => navigateTo(inputUrl)}
          className="h-7 px-2 text-xs font-medium"
        >
          Go
        </Button>

        <Button
          type="button"
          variant={useGatewayProxy ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setUseGatewayProxy((prev) => !prev)
            setIframeBlocked(false)
          }}
          className={`h-7 px-2 text-[10px] gap-1 shrink-0 font-medium ${
            useGatewayProxy
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={useGatewayProxy ? "Gateway Proxy: Active" : "Direct Connection"}
        >
          <IconShieldCheck className="size-3.5" />
          <span className="hidden sm:inline">Proxy</span>
        </Button>
      </div>

      {/* Main Viewport Container - fully fluid and responsive across all screens */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-hidden flex flex-col p-1.5 sm:p-2 bg-muted/15 relative"
      >
        <div className="w-full h-full bg-background border border-border/60 shadow-md rounded-lg overflow-hidden flex flex-col relative">
          {/* 1. Official Live Screencast View */}
          {effectiveMode === "stream" && streamFrame ? (
            <div className="w-full h-full flex items-center justify-center bg-black/95 overflow-auto relative">
              <img
                src={streamFrame}
                alt="Live agent browser screencast"
                onClick={handleStreamClick}
                className="max-w-full max-h-full object-contain cursor-crosshair select-none"
              />
              <div className="absolute top-2 left-2 pointer-events-none">
                <Badge variant="default" className="text-[10px] bg-emerald-600/90 text-white backdrop-blur-sm gap-1">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  Live Stream Active • Click to interact
                </Badge>
              </div>
            </div>
          ) : effectiveMode === "snapshot" && agentActivity?.screenshotUrl ? (
            /* 2. Visual Snapshot View */
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 p-2 overflow-auto relative">
              <img
                src={agentActivity.screenshotUrl}
                alt="Agent browser snapshot"
                className="max-w-full max-h-full object-contain rounded shadow-lg border border-border/60"
              />
              <div className="absolute top-3 left-3">
                <Badge variant="outline" className="text-[10px] bg-background/90 backdrop-blur-sm">
                  Agent Viewport Snapshot
                </Badge>
              </div>
            </div>
          ) : !currentUrl ? (
            /* 3. Responsive Empty State when no URL is loaded */
            <div className="m-auto p-6 max-w-sm text-center space-y-3">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <IconWorld className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Browser Ready
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter a URL above to browse, or let your AI agent drive the browser in real time.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo("https://duckduckgo.com")}
                  className="text-xs h-7"
                >
                  DuckDuckGo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo("https://github.com")}
                  className="text-xs h-7"
                >
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo("https://en.wikipedia.org")}
                  className="text-xs h-7"
                >
                  Wikipedia
                </Button>
              </div>
            </div>
          ) : iframeBlocked ? (
            /* 4. Embedding Blocked State */
            <div className="m-auto p-6 max-w-sm text-center space-y-3">
              <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <IconAlertCircle className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Embedding Blocked
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This page denied direct iframe embedding. Open directly in a new window or retry via Gateway Proxy.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.open(currentUrl, "_blank")}
                  className="w-full gap-1.5"
                >
                  <IconExternalLink className="size-3.5" />
                  Open in New Window
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUseGatewayProxy(true)
                    handleReload()
                  }}
                  className="w-full text-xs gap-1"
                >
                  <IconShieldCheck className="size-3.5" />
                  Retry via Gateway Proxy
                </Button>
              </div>
            </div>
          ) : (
            /* 5. Interactive Web Preview */
            <iframe
              key={`${iframeKey}-${useGatewayProxy}-${proxiedIframeSrc}`}
              ref={iframeRef}
              src={proxiedIframeSrc}
              title="Browser View"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              onLoad={() => setIsIframeLoading(false)}
              onError={() => {
                setIsIframeLoading(false)
                setIframeBlocked(true)
              }}
              className="w-full h-full border-0 bg-white"
            />
          )}

          {/* Watch Mode Overlay: blocks user interaction when agent is actively controlling */}
          {isAgentControlling && effectiveMode === "web" && (
            <div className="absolute inset-0 z-30 bg-background/30 backdrop-blur-[1px] flex flex-col items-center justify-start p-3 select-none cursor-not-allowed animate-in fade-in duration-150 pointer-events-none">
              <div className="bg-background/95 border border-emerald-500/50 shadow-xl rounded-full px-3 py-1 flex items-center gap-2 text-xs backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-semibold text-foreground">AI Controlling Site</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                  <IconLock className="size-3 text-amber-500" />
                  Watch Mode
                </span>
              </div>

              {agentActivity?.lastStep?.command && (
                <div className="mt-2 bg-black/85 text-emerald-400 font-mono text-[10px] px-2.5 py-0.5 rounded border border-emerald-500/30 shadow-md max-w-[85%] truncate">
                  $ {agentActivity.lastStep.command}
                </div>
              )}
            </div>
          )}

          {/* Antigravity Cursor & Click Ripple Animations */}
          {clicks.map((c) => (
            <div
              key={c.id}
              className="absolute pointer-events-none z-50 transform -translate-x-1 -translate-y-1 select-none"
              style={{ left: `${c.x}px`, top: `${c.y}px` }}
            >
              <div
                className="absolute size-14 rounded-full border-2 border-primary/90 bg-primary/20 pointer-events-none"
                style={{
                  top: "0px",
                  left: "0px",
                  animation: "agy-click-ripple 0.75s cubic-bezier(0,0,0.2,1) forwards",
                }}
              />
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] select-none"
                style={{
                  animation: "agy-cursor-bounce 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                <path
                  d="M3 2L10 21L13.5 13.5L21 10L3 2Z"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              {c.label && (
                <div className="absolute left-6 top-3 bg-background/95 border border-primary/50 text-foreground text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md animate-in fade-in zoom-in-90 duration-150">
                  <span className={`size-1.5 rounded-full ${c.isAgent ? "bg-emerald-500 animate-pulse" : "bg-primary"}`} />
                  <span className="text-primary">{c.isAgent ? "AI Click:" : "Click:"}</span>
                  <span className="truncate max-w-[160px] text-foreground">{c.label}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
