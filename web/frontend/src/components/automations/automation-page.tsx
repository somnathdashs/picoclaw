import {
  IconAlertCircle,
  IconBell,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCopy,
  IconEdit,
  IconHistory,
  IconLayoutGrid,
  IconLayoutList,
  IconLoader2,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  type AutomationJob,
  type CronRunRecord,
  type CronSchedule,
  createAutomation,
  deleteAutomation,
  getAutomations,
  runAutomationNow,
  toggleAutomation,
  updateAutomation,
} from "@/api/automations"
import { copyText } from "@/lib/clipboard"
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

dayjs.extend(relativeTime)

const COMMON_CHANNELS = [
  { id: "cli", label: "CLI / Internal" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "slack", label: "Slack" },
  { id: "feishu", label: "Feishu / Lark" },
  { id: "wecom", label: "WeCom" },
  { id: "weixin", label: "WeChat" },
  { id: "dingtalk", label: "DingTalk" },
  { id: "line", label: "LINE" },
  { id: "qq", label: "QQ" },
  { id: "matrix", label: "Matrix" },
  { id: "mqtt", label: "MQTT" },
]

const CRON_PRESETS = [
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at 9:00 AM", expr: "0 9 * * *" },
  { label: "Every day at midnight", expr: "0 0 * * *" },
  { label: "Every weekday (Mon-Fri) at 9:00 AM", expr: "0 9 * * 1-5" },
  { label: "Every Sunday at midnight", expr: "0 0 * * 0" },
]

function describeSchedule(sched?: CronSchedule) {
  if (!sched) return "Custom"
  if (sched.kind === "every" && sched.everyMs) {
    const sec = Math.floor(sched.everyMs / 1000)
    return sec >= 3600
      ? `Every ${sec / 3600}h`
      : `Every ${Math.floor(sec / 60)}m`
  }
  if (sched.kind === "cron") {
    return sched.expr || "Cron"
  }
  if (sched.kind === "at" && sched.atMs) {
    return dayjs(sched.atMs).format("MMM D, HH:mm")
  }
  return "Custom"
}

export function AutomationPage() {
  const [jobs, setJobs] = useState<AutomationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">(
    "active",
  )
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      return (
        (localStorage.getItem("picoclaw_automations_view") as
          | "grid"
          | "list") || "grid"
      )
    } catch {
      return "grid"
    }
  })

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "grid" ? "list" : "grid"
      try {
        localStorage.setItem("picoclaw_automations_view", next)
      } catch {
        // Ignore storage error
      }
      return next
    })
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<AutomationJob | null>(null)
  const [detailsJob, setDetailsJob] = useState<AutomationJob | null>(null)
  const [jobToDelete, setJobToDelete] = useState<AutomationJob | null>(null)
  const [runningJobId, setRunningJobId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (
    text: string,
    id: string,
    msg = "Copied to clipboard",
  ) => {
    const ok = await copyText(text)
    if (ok) {
      setCopiedId(id)
      toast.success(msg)
      setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur))
      }, 2000)
    } else {
      toast.error("Failed to copy to clipboard")
    }
  }

  // Form State
  const [formName, setFormName] = useState("")
  const [formActionType, setFormActionType] = useState<
    "reminder" | "prompt" | "command"
  >("reminder")
  const [formCommand, setFormCommand] = useState("")
  const [formMessage, setFormMessage] = useState("")
  const [formScheduleKind, setFormScheduleKind] = useState<
    "every" | "cron" | "at"
  >("every")
  const [formEveryVal, setFormEveryVal] = useState("60")
  const [formEveryUnit, setFormEveryUnit] = useState<
    "minutes" | "hours" | "seconds"
  >("minutes")
  const [formCronExpr, setFormCronExpr] = useState("0 9 * * *")
  const [formAtDate, setFormAtDate] = useState("")
  const [formChannel, setFormChannel] = useState("cli")
  const [formTo, setFormTo] = useState("")
  const [formEnabled, setFormEnabled] = useState(true)
  const [formDeleteAfterRun, setFormDeleteAfterRun] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getAutomations()
      setJobs(data.jobs || [])
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load automations",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const openCreateDialog = () => {
    setEditingJob(null)
    setFormName("")
    setFormActionType("reminder")
    setFormCommand("")
    setFormMessage("")
    setFormScheduleKind("every")
    setFormEveryVal("60")
    setFormEveryUnit("minutes")
    setFormCronExpr("0 9 * * *")
    setFormAtDate(dayjs().add(1, "hour").format("YYYY-MM-DDTHH:mm"))
    setFormChannel("cli")
    setFormTo("")
    setFormEnabled(true)
    setFormDeleteAfterRun(false)
    setDialogOpen(true)
  }

  const openEditDialog = (job: AutomationJob) => {
    setEditingJob(job)
    setFormName(job.Name || job.name || "")
    const cmd = job.Payload?.Command || job.payload?.command || ""
    const msg = job.Payload?.Message || job.payload?.message || ""
    const kind = job.Payload?.Kind || job.payload?.kind || ""
    const isDeliver = job.Payload?.Deliver ?? job.payload?.deliver ?? false

    if (cmd) {
      setFormActionType("command")
    } else if (kind === "reminder" || isDeliver) {
      setFormActionType("reminder")
    } else {
      setFormActionType("prompt")
    }
    setFormCommand(cmd)
    setFormMessage(msg)

    const sched = job.Schedule || job.schedule
    setFormScheduleKind(sched?.kind || "every")
    if (sched?.kind === "every" && sched.everyMs) {
      const totalSec = Math.floor(sched.everyMs / 1000)
      if (totalSec % 3600 === 0) {
        setFormEveryVal(String(totalSec / 3600))
        setFormEveryUnit("hours")
      } else {
        setFormEveryVal(String(Math.floor(totalSec / 60)))
        setFormEveryUnit("minutes")
      }
    } else if (sched?.kind === "cron") {
      setFormCronExpr(sched.expr || "0 9 * * *")
    } else if (sched?.kind === "at" && sched.atMs) {
      setFormAtDate(dayjs(sched.atMs).format("YYYY-MM-DDTHH:mm"))
    }

    setFormChannel(job.Payload?.Channel || job.payload?.channel || "cli")
    setFormTo(job.Payload?.To || job.payload?.to || "")
    setFormEnabled(job.Enabled ?? job.enabled ?? true)
    setFormDeleteAfterRun(job.DeleteAfterRun ?? job.deleteAfterRun ?? false)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error("Please provide a name for this automation")
      return
    }
    if (formActionType === "command" && !formCommand.trim()) {
      toast.error("Please provide a command to run")
      return
    }
    if (formActionType === "reminder" && !formMessage.trim()) {
      toast.error("Please provide a reminder message")
      return
    }
    if (formActionType === "prompt" && !formMessage.trim()) {
      toast.error("Please provide a prompt message for the agent")
      return
    }

    let schedule: CronSchedule
    if (formScheduleKind === "every") {
      const num = Number.parseInt(formEveryVal, 10) || 60
      const multiplier =
        formEveryUnit === "hours"
          ? 3600000
          : formEveryUnit === "minutes"
            ? 60000
            : 1000
      schedule = { kind: "every", everyMs: num * multiplier }
    } else if (formScheduleKind === "cron") {
      if (!formCronExpr.trim()) {
        toast.error("Please specify a cron expression")
        return
      }
      schedule = { kind: "cron", expr: formCronExpr.trim() }
    } else {
      const atMs = dayjs(formAtDate).valueOf()
      if (Number.isNaN(atMs) || atMs <= Date.now()) {
        toast.error("Please choose a future date and time")
        return
      }
      schedule = { kind: "at", atMs }
    }

    const payload = {
      kind:
        formActionType === "command"
          ? "command"
          : formActionType === "reminder"
            ? "reminder"
            : "agent_turn",
      deliver: formActionType === "reminder",
      message:
        formActionType === "command"
          ? formMessage.trim() || formCommand.trim()
          : formMessage.trim(),
      command: formActionType === "command" ? formCommand.trim() : "",
      channel: formChannel.trim(),
      to: formTo.trim(),
    }

    setSubmitting(true)
    try {
      if (editingJob) {
        const jobId = editingJob.ID || editingJob.id
        await updateAutomation(jobId, {
          name: formName.trim(),
          schedule,
          payload,
          enabled: formEnabled,
          deleteAfterRun: formDeleteAfterRun,
        })
        toast.success("Automation updated successfully")
      } else {
        await createAutomation({
          name: formName.trim(),
          schedule,
          payload,
          enabled: formEnabled,
          deleteAfterRun: formDeleteAfterRun,
        })
        toast.success("Automation created successfully")
      }
      setDialogOpen(false)
      await loadData()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save automation",
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (job: AutomationJob) => {
    const jobId = job.ID || job.id
    const currentEnabled = job.Enabled ?? job.enabled ?? true
    try {
      await toggleAutomation(jobId, !currentEnabled)
      toast.success(
        !currentEnabled ? "Automation activated" : "Automation paused",
      )
      await loadData()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to toggle automation",
      )
    }
  }

  const handleRunNow = async (job: AutomationJob) => {
    const jobId = job.ID || job.id
    setRunningJobId(jobId)
    try {
      await runAutomationNow(jobId)
      toast.success(`Triggered "${job.Name || job.name}" successfully`)
      await loadData()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to run automation",
      )
    } finally {
      setRunningJobId(null)
    }
  }

  const handleDelete = async () => {
    if (!jobToDelete) return
    const jobId = jobToDelete.ID || jobToDelete.id
    try {
      await deleteAutomation(jobId)
      toast.success("Automation removed")
      setJobToDelete(null)
      await loadData()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete automation",
      )
    }
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const name = j.Name || j.name || ""
      const cmd = j.Payload?.Command || j.payload?.command || ""
      const msg = j.Payload?.Message || j.payload?.message || ""
      const isEnabled = j.Enabled ?? j.enabled ?? true

      if (filterStatus === "active" && !isEnabled) return false
      if (filterStatus === "paused" && isEnabled) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          name.toLowerCase().includes(q) ||
          cmd.toLowerCase().includes(q) ||
          msg.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [jobs, search, filterStatus])

  const stats = useMemo(() => {
    const total = jobs.length
    const active = jobs.filter((j) => j.Enabled ?? j.enabled ?? true).length
    const commands = jobs.filter((j) =>
      Boolean(j.Payload?.Command || j.payload?.command),
    ).length
    return { total, active, commands }
  }, [jobs])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Automations">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-8 px-2 sm:h-9 sm:px-3 gap-1.5"
            title="Refresh automations"
          >
            <IconRefresh
              className={`size-4 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="bg-primary text-primary-foreground h-8 px-2 sm:h-9 sm:px-3 gap-1.5 shadow-sm"
            title="New Automation"
          >
            <IconPlus className="size-4" />
            <span className="hidden sm:inline">New Automation</span>
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6 md:px-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <Card className="border-border/60 shadow-xs">
            <CardContent className="flex items-center justify-between p-3 sm:p-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Total Automations
                </p>
                <p className="text-foreground mt-0.5 text-xl font-bold sm:text-2xl">
                  {stats.total}
                </p>
              </div>
              <div className="bg-primary/10 text-primary rounded-xl p-2 sm:p-2.5">
                <IconClock className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="flex items-center justify-between p-3 sm:p-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Active Schedules
                </p>
                <p className="mt-0.5 text-xl font-bold text-emerald-600 sm:text-2xl dark:text-emerald-400">
                  {stats.active}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 sm:p-2.5 dark:text-emerald-400">
                <IconCheck className="size-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 col-span-2 shadow-xs lg:col-span-1">
            <CardContent className="flex items-center justify-between p-3 sm:p-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Command Scripts
                </p>
                <p className="mt-0.5 text-xl font-bold text-indigo-600 sm:text-2xl dark:text-indigo-400">
                  {stats.commands}
                </p>
              </div>
              <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 sm:p-2.5 dark:text-indigo-400">
                <IconTerminal2 className="size-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, command, or message..."
              className="h-9 pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Tabs
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="h-9">
                <TabsTrigger value="active" className="text-xs">
                  Active
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="paused" className="text-xs">
                  Paused
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleViewMode}
              className="border-border/60 size-9 shrink-0"
              title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
              aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {viewMode === "grid" ? (
                <IconLayoutList className="size-4" />
              ) : (
                <IconLayoutGrid className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Automations List / Cards */}
        {loading ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-20">
            <IconLoader2 className="size-8 animate-spin" />
            <p className="text-sm">Loading automations...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="border-border/80 border-2 border-dashed p-8 text-center sm:p-12">
            <div className="bg-primary/10 text-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
              <IconClock className="size-6" />
            </div>
            <h3 className="text-foreground text-base font-semibold">
              No automations found
            </h3>
            <p className="text-muted-foreground mx-auto mt-1 mb-4 max-w-md text-xs sm:text-sm">
              Schedule recurring reminders, agent prompts, or shell commands
              with automated delivery to any channel.
            </p>
            <Button onClick={openCreateDialog} size="sm" className="gap-2">
              <IconPlus className="size-4" />
              Create First Automation
            </Button>
          </Card>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-3"
            }
          >
            {filteredJobs.map((job) => {
              const jobId = job.ID || job.id
              const name = job.Name || job.name || "Untitled"
              const isEnabled = job.Enabled ?? job.enabled ?? true
              const cmd = job.Payload?.Command || job.payload?.command || ""
              const msg = job.Payload?.Message || job.payload?.message || ""
              const ch = job.Payload?.Channel || job.payload?.channel || "cli"
              const to = job.Payload?.To || job.payload?.to || ""
              const sched = job.Schedule || job.schedule
              const state = job.State || job.state

              const scheduleDesc = describeSchedule(sched)
              const nextRun = state?.NextRunAtMS || state?.nextRunAtMs
              const lastRun = state?.LastRunAtMS || state?.lastRunAtMs
              const lastStatus = state?.LastStatus || state?.lastStatus
              const isReminder =
                (job.Payload?.Kind || job.payload?.kind) === "reminder" ||
                (job.Payload?.Deliver ?? job.payload?.deliver)

              if (viewMode === "list") {
                return (
                  <Card
                    key={jobId}
                    className={`border-border/60 transition-all duration-200 hover:shadow-sm ${
                      !isEnabled ? "bg-muted/20 opacity-75" : ""
                    } p-3 sm:p-4`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-foreground truncate text-sm font-semibold sm:text-base">
                            {name}
                          </h4>
                          {cmd ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                            >
                              <IconTerminal2 className="size-3" /> Command
                            </Badge>
                          ) : isReminder ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] font-medium text-sky-600 dark:text-sky-400"
                            >
                              <IconBell className="size-3" /> Reminder
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-purple-500/30 bg-purple-500/10 px-1.5 py-0 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                            >
                              <IconSparkles className="size-3" /> Agent Prompt
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] capitalize"
                          >
                            {ch}
                            {to ? ` (${to})` : ""}
                          </Badge>
                        </div>

                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs sm:gap-4">
                          <span className="flex items-center gap-1 font-mono">
                            <IconCalendar className="size-3.5 shrink-0" />
                            {scheduleDesc}
                          </span>
                          {nextRun && (
                            <span className="text-primary/90 text-[11px]">
                              Next: {dayjs(nextRun).fromNow()}
                            </span>
                          )}
                          {lastRun && (
                            <span className="flex items-center gap-1 text-[11px]">
                              Last: {dayjs(lastRun).fromNow()}
                              {lastStatus === "ok" ? (
                                <IconCheck className="size-3 text-emerald-600" />
                              ) : lastStatus === "error" ? (
                                <IconAlertCircle className="text-destructive size-3" />
                              ) : null}
                            </span>
                          )}
                        </div>

                        <div className="bg-muted/40 text-muted-foreground line-clamp-1 rounded px-2 py-1 font-mono text-[11px]">
                          {cmd ? (
                            <span>$ {cmd}</span>
                          ) : (
                            <span>{msg || "No message content"}</span>
                          )}
                        </div>
                      </div>

                      <div className="border-border/40 flex shrink-0 items-center justify-between gap-2 border-t pt-2 sm:border-t-0 sm:pt-0 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => void handleToggle(job)}
                            className="scale-90"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRunNow(job)}
                            disabled={runningJobId === jobId}
                            className="h-8 gap-1 text-xs"
                          >
                            {runningJobId === jobId ? (
                              <IconLoader2 className="size-3.5 animate-spin" />
                            ) : (
                              <IconPlayerPlay className="size-3.5" />
                            )}
                            <span className="hidden sm:inline">Run Now</span>
                          </Button>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground size-7"
                            onClick={() => setDetailsJob(job)}
                            title="View Execution History & Details"
                          >
                            <IconHistory className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground size-7"
                            onClick={() => openEditDialog(job)}
                            title="Edit Automation"
                          >
                            <IconEdit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-7"
                            onClick={() => setJobToDelete(job)}
                            title="Delete Automation"
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              }

              return (
                <Card
                  key={jobId}
                  className={`border-border/60 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                    !isEnabled ? "bg-muted/20 opacity-75" : ""
                  }`}
                >
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-foreground truncate text-sm font-semibold sm:text-base">
                            {name}
                          </h4>
                          {cmd ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                            >
                              <IconTerminal2 className="size-3" /> Command
                            </Badge>
                          ) : isReminder ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-sky-500/30 bg-sky-500/10 px-1.5 py-0 text-[10px] font-medium text-sky-600 dark:text-sky-400"
                            >
                              <IconBell className="size-3" /> Reminder
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-purple-500/30 bg-purple-500/10 px-1.5 py-0 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                            >
                              <IconSparkles className="size-3" /> Agent Prompt
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                          <IconCalendar className="size-3.5 shrink-0" />
                          <span className="font-mono">{scheduleDesc}</span>
                        </p>
                      </div>

                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => void handleToggle(job)}
                        className="scale-90"
                      />
                    </div>

                    {/* Preview box */}
                    <div className="bg-muted/50 text-muted-foreground border-border/40 line-clamp-2 rounded-lg border p-2.5 font-mono text-xs">
                      {cmd ? (
                        <span className="text-foreground">$ {cmd}</span>
                      ) : (
                        <span>{msg || "No message content"}</span>
                      )}
                    </div>

                    {/* Routing & Metadata */}
                    <div className="text-muted-foreground border-border/30 flex flex-wrap items-center justify-between gap-2 border-t pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-medium capitalize">
                          {ch}
                        </span>
                        {to && (
                          <span className="max-w-[120px] truncate opacity-75">
                            ({to})
                          </span>
                        )}
                      </div>

                      {nextRun ? (
                        <span
                          className="text-primary/90 text-[11px]"
                          title={dayjs(nextRun).format("YYYY-MM-DD HH:mm:ss")}
                        >
                          Next: {dayjs(nextRun).fromNow()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">
                          No run pending
                        </span>
                      )}
                    </div>

                    {lastRun && (
                      <div className="text-muted-foreground flex items-center justify-between pt-1 text-[11px]">
                        <span>Last run: {dayjs(lastRun).fromNow()}</span>
                        {lastStatus === "ok" ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <IconCheck className="size-3" /> Success
                          </span>
                        ) : lastStatus === "error" ? (
                          <span className="text-destructive flex items-center gap-1 font-medium">
                            <IconAlertCircle className="size-3" /> Error
                          </span>
                        ) : null}
                      </div>
                    )}
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="bg-muted/30 border-border/40 flex items-center justify-between gap-1 border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRunNow(job)}
                      disabled={runningJobId === jobId}
                      className="hover:text-primary h-7 gap-1 text-xs"
                    >
                      {runningJobId === jobId ? (
                        <IconLoader2 className="size-3.5 animate-spin" />
                      ) : (
                        <IconPlayerPlay className="size-3.5" />
                      )}
                      Run Now
                    </Button>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground size-7"
                        onClick={() => setDetailsJob(job)}
                        title="View Execution History & Details"
                      >
                        <IconHistory className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground size-7"
                        onClick={() => openEditDialog(job)}
                        title="Edit Automation"
                      >
                        <IconEdit className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-7"
                        onClick={() => setJobToDelete(job)}
                        title="Delete Automation"
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
            <DialogDescription>
              Configure scheduled commands or agent prompts with automated
              delivery.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="job-name" className="text-xs font-semibold">
                Name
              </Label>
              <Input
                id="job-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Daily server health check"
                required
              />
            </div>

            {/* Action Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Action Type</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={formActionType === "reminder" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormActionType("reminder")}
                  className="h-auto flex-col items-start gap-0.5 p-2 text-left sm:items-center sm:text-center"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <IconBell className="size-3.5 shrink-0" />
                    Reminder
                  </div>
                  <span className="text-[10px] opacity-75 leading-tight">
                    Direct text (No AI)
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={formActionType === "prompt" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormActionType("prompt")}
                  className="h-auto flex-col items-start gap-0.5 p-2 text-left sm:items-center sm:text-center"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <IconSparkles className="size-3.5 shrink-0" />
                    Agent Prompt
                  </div>
                  <span className="text-[10px] opacity-75 leading-tight">
                    AI reasoning & tools
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={formActionType === "command" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormActionType("command")}
                  className="h-auto flex-col items-start gap-0.5 p-2 text-left sm:items-center sm:text-center"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <IconTerminal2 className="size-3.5 shrink-0" />
                    Shell Command
                  </div>
                  <span className="text-[10px] opacity-75 leading-tight">
                    Execute local script
                  </span>
                </Button>
              </div>
            </div>

            {formActionType === "command" ? (
              <div className="space-y-1.5">
                <Label htmlFor="job-command" className="text-xs font-semibold">
                  Shell Command
                </Label>
                <Input
                  id="job-command"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="e.g. df -h || uptime"
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  The command runs directly in your workspace shell and delivers stdout/stderr.
                </p>
              </div>
            ) : formActionType === "reminder" ? (
              <div className="space-y-1.5">
                <Label htmlFor="job-msg" className="text-xs font-semibold">
                  Reminder Message
                </Label>
                <Textarea
                  id="job-msg"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="e.g. Time for daily standup / Don't forget your meeting..."
                  rows={3}
                  className="text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Delivered directly to your destination channel without invoking AI processing.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="job-msg" className="text-xs font-semibold">
                  Agent Prompt
                </Label>
                <Textarea
                  id="job-msg"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="e.g. Summarize the daily unread emails and top news..."
                  rows={3}
                  className="text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Triggers an AI reasoning turn. The agent can use tools and generate a response.
                </p>
              </div>
            )}

            {/* Schedule Section */}
            <div className="border-border/40 space-y-2 border-t pt-1">
              <Label className="text-xs font-semibold">Schedule Trigger</Label>
              <Tabs
                value={formScheduleKind}
                onValueChange={(v) => setFormScheduleKind(v as any)}
              >
                <TabsList className="grid h-8 grid-cols-3">
                  <TabsTrigger value="every" className="text-xs">
                    Interval
                  </TabsTrigger>
                  <TabsTrigger value="cron" className="text-xs">
                    Cron Expr
                  </TabsTrigger>
                  <TabsTrigger value="at" className="text-xs">
                    Specific Time
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="every" className="pt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={formEveryVal}
                      onChange={(e) => setFormEveryVal(e.target.value)}
                      className="w-24 text-sm"
                    />
                    <Select
                      value={formEveryUnit}
                      onValueChange={(v) => setFormEveryUnit(v as any)}
                    >
                      <SelectTrigger className="w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="seconds">Seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="cron" className="space-y-2 pt-2">
                  <Input
                    value={formCronExpr}
                    onChange={(e) => setFormCronExpr(e.target.value)}
                    placeholder="0 9 * * *"
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CRON_PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.expr}
                        onClick={() => setFormCronExpr(p.expr)}
                        className="bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded px-2 py-0.5 text-[11px]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="at" className="pt-2">
                  <Input
                    type="datetime-local"
                    value={formAtDate}
                    onChange={(e) => setFormAtDate(e.target.value)}
                    className="text-xs"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Delivery Target Section */}
            <div className="border-border/40 space-y-2 border-t pt-1">
              <Label className="text-xs font-semibold">
                Output Delivery Target
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label
                    htmlFor="job-channel"
                    className="text-muted-foreground text-[11px]"
                  >
                    Channel
                  </Label>
                  <Select value={formChannel} onValueChange={setFormChannel}>
                    <SelectTrigger id="job-channel" className="text-xs">
                      <SelectValue placeholder="Select Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="job-to"
                    className="text-muted-foreground text-[11px]"
                  >
                    Deliver To (Chat/Phone ID)
                  </Label>
                  <Input
                    id="job-to"
                    value={formTo}
                    onChange={(e) => setFormTo(e.target.value)}
                    placeholder="e.g. +123456789 or direct"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Options & Switches */}
            <div className="border-border/40 space-y-3 border-t pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="job-enabled" className="text-xs font-medium">
                    Enabled immediately
                  </Label>
                  <p className="text-muted-foreground text-[11px]">
                    Activate this automation schedule right away.
                  </p>
                </div>
                <Switch
                  id="job-enabled"
                  checked={formEnabled}
                  onCheckedChange={setFormEnabled}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="job-delete" className="text-xs font-medium">
                    Delete task after execution
                  </Label>
                  <p className="text-muted-foreground text-[11px]">
                    Automatically purge task upon completion. Leave off to preserve execution logs and outputs.
                  </p>
                </div>
                <Switch
                  id="job-delete"
                  checked={formDeleteAfterRun}
                  onCheckedChange={setFormDeleteAfterRun}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <IconLoader2 className="mr-1.5 size-4 animate-spin" />
                ) : null}
                {editingJob ? "Save Changes" : "Create Automation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Execution History & Details Modal */}
      <Dialog
        open={Boolean(detailsJob)}
        onOpenChange={() => setDetailsJob(null)}
      >
        <DialogContent className="flex max-h-[90vh] sm:max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              <IconHistory className="text-primary size-5 shrink-0" />
              <span className="truncate">{detailsJob?.Name || detailsJob?.name}</span>
              {detailsJob && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                >
                  {(detailsJob.Enabled ?? detailsJob.enabled ?? true)
                    ? "Active"
                    : "Paused"}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              View execution history, duration, outputs, and configuration.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="history" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 mb-3 w-full">
              <TabsTrigger value="history" className="gap-1.5 text-xs">
                <IconHistory className="size-3.5" />
                <span>Runs ({((detailsJob?.State?.History || detailsJob?.state?.history) || []).length})</span>
              </TabsTrigger>
              <TabsTrigger value="info" className="gap-1.5 text-xs">
                <IconClock className="size-3.5" />
                <span>Details</span>
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-1.5 text-xs">
                <IconCopy className="size-3.5" />
                <span>JSON</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pr-1">
              <TabsContent value="history" className="mt-0 space-y-3">
                {(() => {
                  const history =
                    detailsJob?.State?.History ||
                    detailsJob?.state?.history ||
                    []
                  if (history.length === 0) {
                    return (
                      <div className="bg-muted/40 border-border/50 text-muted-foreground rounded-xl border p-6 text-center text-xs">
                        <IconClock className="mx-auto mb-2 size-8 opacity-40" />
                        <p className="font-medium text-foreground">No run history recorded yet</p>
                        <p className="mt-1">
                          When this automation fires or you click &quot;Run Now&quot;, executions, durations, and output responses will appear here.
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-2.5">
                      {history.map((rec: CronRunRecord, idx: number) => {
                        const status = rec.status
                        const output = rec.output || rec.Output
                        const error = rec.error || rec.Error
                        return (
                          <div
                            key={idx}
                            className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-3 text-xs shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 font-medium">
                                {status === "ok" ? (
                                  <Badge className="border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400">
                                    Success
                                  </Badge>
                                ) : status === "running" ? (
                                  <Badge className="border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400">
                                    Running
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="destructive"
                                    className="px-1.5 py-0 text-[10px]"
                                  >
                                    Failed
                                  </Badge>
                                )}
                                <span className="text-muted-foreground text-[11px] font-mono">
                                  {rec.durationMs}ms
                                </span>
                              </div>
                              <span className="text-muted-foreground text-[11px]">
                                {dayjs(rec.runAtMs).format("YYYY-MM-DD HH:mm:ss")} ({dayjs(rec.runAtMs).fromNow()})
                              </span>
                            </div>

                            {/* Output / Response Content */}
                            {output && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                                  <span>Output / Response:</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-1.5 text-[10px]"
                                    onClick={() => handleCopy(output, `out-${idx}`, "Output copied")}
                                  >
                                    {copiedId === `out-${idx}` ? (
                                      <IconCheck className="size-3 text-emerald-500" />
                                    ) : (
                                      <IconCopy className="size-3" />
                                    )}
                                    <span>Copy</span>
                                  </Button>
                                </div>
                                <pre className="bg-muted/60 border-border/50 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed break-all">
                                  {output}
                                </pre>
                              </div>
                            )}

                            {/* Error Content */}
                            {error && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-destructive font-medium">
                                  <span>Error:</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-1.5 text-[10px] text-destructive hover:text-destructive"
                                    onClick={() => handleCopy(error, `err-${idx}`, "Error copied")}
                                  >
                                    {copiedId === `err-${idx}` ? (
                                      <IconCheck className="size-3 text-emerald-500" />
                                    ) : (
                                      <IconCopy className="size-3" />
                                    )}
                                    <span>Copy</span>
                                  </Button>
                                </div>
                                <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-lg border p-2.5 font-mono text-[11px] break-all">
                                  {error}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </TabsContent>

              <TabsContent value="info" className="mt-0 space-y-3">
                {detailsJob && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="bg-muted/40 border-border/50 rounded-lg border p-2.5">
                        <span className="text-muted-foreground block text-[11px]">Channel & Recipient</span>
                        <span className="font-semibold text-foreground capitalize">
                          {detailsJob.Payload?.Channel || detailsJob.payload?.channel || "cli"}
                        </span>
                        {(detailsJob.Payload?.To || detailsJob.payload?.to) && (
                          <span className="text-muted-foreground block text-[11px]">
                            To: {detailsJob.Payload?.To || detailsJob.payload?.to}
                          </span>
                        )}
                      </div>
                      <div className="bg-muted/40 border-border/50 rounded-lg border p-2.5">
                        <span className="text-muted-foreground block text-[11px]">Schedule</span>
                        <span className="font-mono font-semibold text-foreground">
                          {describeSchedule(detailsJob.Schedule || detailsJob.schedule)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted/40 border-border/50 rounded-lg border p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground text-[11px]">
                          {(detailsJob.Payload?.Command || detailsJob.payload?.command)
                            ? "Shell Command"
                            : (detailsJob.Payload?.Kind || detailsJob.payload?.kind) === "reminder" || (detailsJob.Payload?.Deliver ?? detailsJob.payload?.deliver)
                              ? "Reminder Message"
                              : "Agent Prompt"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 gap-1 px-1.5 text-[10px]"
                          onClick={() => {
                            const text =
                              detailsJob.Payload?.Command ||
                              detailsJob.payload?.command ||
                              detailsJob.Payload?.Message ||
                              detailsJob.payload?.message ||
                              ""
                            handleCopy(text, "detail-msg", "Content copied")
                          }}
                        >
                          {copiedId === "detail-msg" ? (
                            <IconCheck className="size-3 text-emerald-500" />
                          ) : (
                            <IconCopy className="size-3" />
                          )}
                          <span>Copy</span>
                        </Button>
                      </div>
                      <div className="font-mono whitespace-pre-wrap text-foreground break-all">
                        {detailsJob.Payload?.Command ||
                          detailsJob.payload?.command ||
                          detailsJob.Payload?.Message ||
                          detailsJob.payload?.message ||
                          "None"}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="json" className="mt-0">
                <pre className="bg-muted/60 border-border/40 max-h-72 overflow-x-auto rounded-lg border p-3 font-mono text-xs">
                  {JSON.stringify(detailsJob, null, 2)}
                </pre>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t pt-3 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() =>
                handleCopy(
                  JSON.stringify(detailsJob, null, 2),
                  "modal-json",
                  "JSON copied to clipboard",
                )
              }
            >
              {copiedId === "modal-json" ? (
                <IconCheck className="size-3.5 text-emerald-500" />
              ) : (
                <IconCopy className="size-3.5" />
              )}
              <span>Copy JSON</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => setDetailsJob(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(jobToDelete)}
        onOpenChange={() => setJobToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconTrash className="text-destructive size-5" />
              Delete Automation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{jobToDelete?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
