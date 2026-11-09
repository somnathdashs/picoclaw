import {
  IconActivity,
  IconArrowRight,
  IconAtom,
  IconBrandDiscord,
  IconBrandSlack,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconClock,
  IconCpu,
  IconDatabase,
  IconMessageCircle,
  IconPlayerPlay,
  IconPlus,
  IconPower,
  IconRefresh,
  IconServer,
  IconSparkles,
  IconThermometer,
} from "@tabler/icons-react"
import { Link, useNavigate } from "@tanstack/react-router"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useEffect, useState } from "react"

import {
  type AutomationJob,
  getAutomations,
  runAutomationNow,
} from "@/api/automations"
import { type SupportedChannel, getChannelsCatalog } from "@/api/channels"
import {
  type SessionSummary,
  getCachedSessions,
  getSessions,
} from "@/api/sessions"
import { type DeviceState, getDeviceState } from "@/api/system"
import { type WhatsAppStatus, getWhatsAppStatus } from "@/api/whatsapp"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useChatModels } from "@/hooks/use-chat-models"
import { useGateway } from "@/hooks/use-gateway"

dayjs.extend(relativeTime)

const DASHBOARD_CACHE_KEY = "picoclaw_dashboard_summary_cache"

function getCachedDashboardSummary() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setCachedDashboardSummary(data: {
  automations: AutomationJob[]
  channels: SupportedChannel[]
  deviceState?: DeviceState | null
}) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore write error
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "Just started"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    state: gwState,
    start,
    stop,
    loading: gwLoading,
    canStart,
  } = useGateway()
  const { defaultModelName } = useChatModels({
    isConnected: gwState === "running",
  })

  const [cachedSummary] = useState(getCachedDashboardSummary)
  const [automations, setAutomations] = useState<AutomationJob[]>(
    () => cachedSummary?.automations || [],
  )
  const [channels, setChannels] = useState<SupportedChannel[]>(
    () => cachedSummary?.channels || [],
  )
  const [sessions, setSessions] = useState<SessionSummary[]>(() =>
    getCachedSessions(),
  )
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(
    null,
  )
  const [deviceState, setDeviceState] = useState<DeviceState | null>(
    () => cachedSummary?.deviceState || null,
  )
  const [loading, setLoading] = useState(
    () => !cachedSummary && sessions.length === 0,
  )

  const loadDashboardData = async () => {
    try {
      const [autoRes, chanRes, sessRes, waRes, devRes] = await Promise.allSettled([
        getAutomations(),
        getChannelsCatalog(),
        getSessions(0, 50),
        getWhatsAppStatus(),
        getDeviceState(),
      ])

      let nextAutomations = automations
      let nextChannels = channels
      let nextDeviceState = deviceState

      if (autoRes.status === "fulfilled") {
        nextAutomations = autoRes.value.jobs || []
        setAutomations(nextAutomations)
      }
      if (chanRes.status === "fulfilled") {
        nextChannels = chanRes.value.channels || []
        setChannels(nextChannels)
      }
      if (sessRes.status === "fulfilled") {
        const fetchedSessions = Array.isArray(sessRes.value)
          ? sessRes.value
          : (sessRes.value as any)?.sessions || []
        setSessions(fetchedSessions)
      }
      if (waRes.status === "fulfilled") {
        setWhatsappStatus(waRes.value)
      }
      if (devRes.status === "fulfilled") {
        nextDeviceState = devRes.value
        setDeviceState(nextDeviceState)
      }

      setCachedDashboardSummary({
        automations: nextAutomations,
        channels: nextChannels,
        deviceState: nextDeviceState,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
    const timer = setInterval(() => {
      void getDeviceState().then(setDeviceState).catch(() => {})
    }, 20000)
    return () => clearInterval(timer)
  }, [])

  const isRunning = gwState === "running"
  const activeAutomationsCount = automations.filter(
    (a) => a.enabled ?? true,
  ).length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Dashboard">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDashboardData()}
            disabled={loading}
            className="h-8 px-2 sm:h-9 sm:px-3 gap-1.5"
            title="Refresh dashboard"
          >
            <IconRefresh
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="bg-primary text-primary-foreground h-8 px-2 sm:h-9 sm:px-3 gap-1.5 shadow-sm"
            title="Open Chat"
          >
            <IconMessageCircle className="size-4" />
            <span className="hidden sm:inline">Open Chat</span>
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6 md:px-8">
        {/* Welcome & Overview Banner */}
        <div className="from-primary/10 via-primary/5 border-primary/20 relative overflow-hidden rounded-2xl border bg-gradient-to-r to-transparent p-5 shadow-xs sm:p-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-md p-1">
                  <IconSparkles className="size-4" />
                </span>
                <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                  PicoClaw Control Center
                </h2>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Ultra-lightweight personal AI agent orchestrator with
                multi-channel routing and automated tasks.
              </p>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              {isRunning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void stop()}
                  disabled={gwLoading}
                  className="h-9 w-full gap-1.5 sm:w-auto"
                >
                  <IconPower className="size-4" />
                  Stop Gateway
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void start()}
                  disabled={gwLoading || !canStart}
                  className="h-9 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                >
                  <IconPlayerPlay className="size-4" />
                  Start Gateway
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Gateway Status */}
          <Card className="border-border/60 shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Gateway Engine
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`size-2.5 rounded-full ${
                      isRunning
                        ? "animate-pulse bg-emerald-500"
                        : "bg-destructive"
                    }`}
                  />
                  <span className="text-foreground text-sm font-bold capitalize sm:text-base">
                    {gwState}
                  </span>
                </div>
              </div>
              <div className="bg-primary/10 text-primary rounded-xl p-2 sm:p-2.5">
                <IconActivity className="size-5" />
              </div>
            </CardContent>
          </Card>

          {/* Active AI Model */}
          <Card className="border-border/60 shadow-xs">
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Active Model
                </p>
                <p
                  className="text-foreground mt-1 truncate text-sm font-bold sm:text-base"
                  title={defaultModelName || "None"}
                >
                  {defaultModelName || "No Model Set"}
                </p>
              </div>
              <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 sm:p-2.5 dark:text-indigo-400">
                <IconAtom className="size-5" />
              </div>
            </CardContent>
          </Card>

          {/* Active Automations */}
          <Link to="/automations" className="block">
            <Card className="border-border/60 hover:border-primary/50 h-full cursor-pointer shadow-xs transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Automations
                  </p>
                  <p className="text-foreground mt-1 text-sm font-bold sm:text-base">
                    {activeAutomationsCount}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      / {automations.length}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 sm:p-2.5 dark:text-amber-400">
                  <IconClock className="size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Chat Sessions */}
          <Link to="/chat-history" className="block">
            <Card className="border-border/60 hover:border-primary/50 h-full cursor-pointer shadow-xs transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Chat History
                  </p>
                  <p className="text-foreground mt-1 text-sm font-bold sm:text-base">
                    {sessions.length}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      sessions
                    </span>
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 sm:p-2.5 dark:text-emerald-400">
                  <IconMessageCircle className="size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Device State & Resource Consumption */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary rounded-md p-1">
                <IconServer className="size-4" />
              </div>
              <h3 className="text-foreground text-sm font-semibold sm:text-base">
                Device State & Resources
              </h3>
            </div>
            {deviceState && (
              <span className="text-muted-foreground text-[11px] sm:text-xs font-mono">
                {deviceState.os} ({deviceState.arch}) • {deviceState.num_cpu} CPUs • Up {formatUptime(deviceState.uptime_seconds)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
            {/* RAM Usage Card */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                      <IconCpu className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold sm:text-sm">
                        RAM Usage
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {deviceState
                          ? `${formatBytes(deviceState.ram.used_bytes)} / ${formatBytes(deviceState.ram.total_bytes)}`
                          : "Measuring..."}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      (deviceState?.ram.used_percent ?? 0) > 85
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : (deviceState?.ram.used_percent ?? 0) > 70
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {deviceState?.ram.used_percent ?? 0}%
                  </Badge>
                </div>

                {/* System Progress Bar */}
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (deviceState?.ram.used_percent ?? 0) > 85
                        ? "bg-rose-500"
                        : (deviceState?.ram.used_percent ?? 0) > 70
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                    style={{
                      width: `${Math.min(100, deviceState?.ram.used_percent ?? 0)}%`,
                    }}
                  />
                </div>

                {/* Sub metrics & PicoClaw usage */}
                <div className="border-border/40 flex flex-wrap items-center justify-between gap-1 border-t pt-2 text-[11px]">
                  <span className="text-muted-foreground">
                    Free:{" "}
                    <strong className="text-foreground font-medium">
                      {formatBytes(deviceState?.ram.free_bytes)}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">PicoClaw:</span>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px] font-medium"
                    >
                      {formatBytes(deviceState?.ram.picoclaw_bytes)}
                      {deviceState?.ram.picoclaw_percent
                        ? ` (${deviceState.ram.picoclaw_percent}%)`
                        : ""}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage State Card */}
            <Card className="border-border/60 shadow-xs">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                      <IconDatabase className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold sm:text-sm">
                        Storage State
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {deviceState
                          ? `${formatBytes(deviceState.storage.free_bytes)} Free of ${formatBytes(deviceState.storage.total_bytes)}`
                          : "Measuring..."}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      (deviceState?.storage.used_percent ?? 0) > 90
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {deviceState?.storage.used_percent ?? 0}% Used
                  </Badge>
                </div>

                {/* Storage Progress Bar */}
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (deviceState?.storage.used_percent ?? 0) > 90
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, deviceState?.storage.used_percent ?? 0)}%`,
                    }}
                  />
                </div>

                {/* Sub metrics & PicoClaw footprint */}
                <div className="border-border/40 flex flex-wrap items-center justify-between gap-1 border-t pt-2 text-[11px]">
                  <span className="text-muted-foreground">
                    Used:{" "}
                    <strong className="text-foreground font-medium">
                      {formatBytes(deviceState?.storage.used_bytes)}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">PicoClaw:</span>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px] font-medium"
                    >
                      {formatBytes(deviceState?.storage.picoclaw_bytes)}
                      {deviceState?.storage.picoclaw_percent
                        ? ` (${deviceState.storage.picoclaw_percent}%)`
                        : ""}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Temperature Card */}
            <Card className="border-border/60 col-span-1 shadow-xs sm:col-span-2 lg:col-span-1">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-lg p-2 ${
                        deviceState?.temperature.status === "hot"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : deviceState?.temperature.status === "warm"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : deviceState?.temperature.available
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <IconThermometer className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-foreground text-xs font-semibold sm:text-sm">
                        Device Temperature
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {deviceState?.temperature.available
                          ? `${deviceState.temperature.celsius}°C (${deviceState.temperature.fahrenheit}°F)`
                          : "Thermal sensor"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold capitalize ${
                      deviceState?.temperature.status === "hot"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : deviceState?.temperature.status === "warm"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : deviceState?.temperature.available
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-muted text-muted-foreground"
                    }`}
                  >
                    {deviceState?.temperature.available
                      ? deviceState.temperature.status
                      : "N/A"}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between pt-0.5">
                  <div className="text-foreground text-2xl font-bold tracking-tight">
                    {deviceState?.temperature.available
                      ? `${deviceState.temperature.celsius}°C`
                      : "N/A"}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {deviceState?.temperature.available
                      ? deviceState.temperature.status === "hot"
                        ? "High temperature load"
                        : deviceState.temperature.status === "warm"
                          ? "Moderate thermal load"
                          : "Optimal operating temperature"
                      : "Sensor unavailable on host"}
                  </span>
                </div>

                <div className="border-border/40 flex items-center justify-between border-t pt-2 text-[11px]">
                  <span className="text-muted-foreground">Thermal Zone</span>
                  <span className="text-foreground font-mono font-medium">
                    {deviceState?.temperature.available ? "ACPI / Zone0" : "Unavailable"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Channels Status Strip */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">
              Featured Channels
            </h3>
            <span className="text-muted-foreground text-xs">
              Quick configuration access
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* WhatsApp Card */}
            <Link to="/channels/$name" params={{ name: "whatsapp" }}>
              <Card className="border-border/60 cursor-pointer shadow-xs transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <IconBrandWhatsapp className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-foreground text-sm font-semibold">
                        WhatsApp
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        {whatsappStatus?.linked
                          ? "Paired & Linked"
                          : "Native / Bridge"}
                      </p>
                    </div>
                  </div>
                  {whatsappStatus?.linked ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600"
                    >
                      Linked
                    </Badge>
                  ) : (
                    <IconArrowRight className="text-muted-foreground size-4" />
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Telegram Card */}
            <Link to="/channels/$name" params={{ name: "telegram" }}>
              <Card className="border-border/60 cursor-pointer shadow-xs transition-all hover:border-sky-500/50 hover:bg-sky-500/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      <IconBrandTelegram className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-foreground text-sm font-semibold">
                        Telegram
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        Bot API & Polling
                      </p>
                    </div>
                  </div>
                  <IconArrowRight className="text-muted-foreground size-4" />
                </CardContent>
              </Card>
            </Link>

            {/* Discord Card */}
            <Link to="/channels/$name" params={{ name: "discord" }}>
              <Card className="border-border/60 cursor-pointer shadow-xs transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      <IconBrandDiscord className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-foreground text-sm font-semibold">
                        Discord
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        Bot gateway client
                      </p>
                    </div>
                  </div>
                  <IconArrowRight className="text-muted-foreground size-4" />
                </CardContent>
              </Card>
            </Link>

            {/* Slack Card */}
            <Link to="/channels/$name" params={{ name: "slack" }}>
              <Card className="border-border/60 cursor-pointer shadow-xs transition-all hover:border-amber-500/50 hover:bg-amber-500/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <IconBrandSlack className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-foreground text-sm font-semibold">
                        Slack
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        Socket Mode app
                      </p>
                    </div>
                  </div>
                  <IconArrowRight className="text-muted-foreground size-4" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* 2 Column Section: Active Automations & Recent Chat History */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Upcoming Automations */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
                <IconClock className="text-primary size-4.5" />
                Active Automations
              </CardTitle>
              <Link
                to="/automations"
                className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View all ({automations.length})
                <IconArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5 p-4 pt-2">
              {automations.length === 0 ? (
                <div className="text-muted-foreground space-y-2 py-8 text-center text-xs">
                  <p>No automations scheduled yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => navigate({ to: "/automations" })}
                  >
                    <IconPlus className="size-3.5" /> Create Automation
                  </Button>
                </div>
              ) : (
                automations.slice(0, 4).map((job) => {
                  const jobId = job.id
                  const name = job.name
                  const cmd = job.payload?.command
                  const ch = job.payload?.channel || "cli"
                  const nextRun = job.state?.nextRunAtMs

                  return (
                    <div
                      key={jobId}
                      className="bg-muted/40 border-border/40 flex items-center justify-between gap-2 rounded-xl border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-foreground truncate text-xs font-semibold sm:text-sm">
                            {name}
                          </p>
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1 py-0 text-[10px]"
                          >
                            {cmd ? "Command" : "Prompt"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
                          <span className="capitalize">{ch}</span>
                          {nextRun && (
                            <>
                              <span>•</span>
                              <span>Next: {dayjs(nextRun).fromNow()}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary size-7 shrink-0"
                        onClick={() => void runAutomationNow(jobId)}
                        title="Run now"
                      >
                        <IconPlayerPlay className="size-3.5" />
                      </Button>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Chat History */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
                <IconMessageCircle className="text-primary size-4.5" />
                Recent Chat Sessions
              </CardTitle>
              <Link
                to="/chat-history"
                className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View all ({sessions.length})
                <IconArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5 p-4 pt-2">
              {sessions.length === 0 ? (
                <div className="text-muted-foreground space-y-2 py-8 text-center text-xs">
                  <p>No chat history yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => navigate({ to: "/" })}
                  >
                    <IconPlus className="size-3.5" /> Start Conversation
                  </Button>
                </div>
              ) : (
                sessions.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate({ to: "/" })}
                    className="bg-muted/40 border-border/40 hover:bg-muted/70 flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-xs font-semibold sm:text-sm">
                        {s.title || "Conversation"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {s.message_count} messages •{" "}
                        {dayjs(s.updated).fromNow()}
                      </p>
                    </div>
                    <IconArrowRight className="text-muted-foreground size-4 shrink-0" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
