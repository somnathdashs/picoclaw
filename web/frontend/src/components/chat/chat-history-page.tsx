import {
  IconArrowLeft,
  IconBrandDiscord,
  IconBrandLine,
  IconBrandMatrix,
  IconBrandQq,
  IconBrandSlack,
  IconBrandTelegram,
  IconBrandWechat,
  IconBrandWhatsapp,
  IconClock,
  IconDotsVertical,
  IconDownload,
  IconFilter,
  IconLayoutGrid,
  IconLayoutList,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { type SessionSummary, exportSessionAsMarkdown } from "@/api/sessions"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { usePicoChat } from "@/hooks/use-pico-chat"
import { useSessionHistory } from "@/hooks/use-session-history"
import { cn } from "@/lib/utils"

dayjs.extend(relativeTime)

function getSessionChannelIcon(channel?: string, className = "size-3.5") {
  const ch = (channel || "").toLowerCase().trim()
  switch (ch) {
    case "whatsapp":
      return <IconBrandWhatsapp className={cn(className, "text-emerald-500")} />
    case "telegram":
      return <IconBrandTelegram className={cn(className, "text-sky-500")} />
    case "discord":
      return <IconBrandDiscord className={cn(className, "text-indigo-500")} />
    case "slack":
      return <IconBrandSlack className={cn(className, "text-amber-500")} />
    case "weixin":
    case "wecom":
      return <IconBrandWechat className={cn(className, "text-green-500")} />
    case "line":
      return <IconBrandLine className={cn(className, "text-emerald-400")} />
    case "matrix":
      return <IconBrandMatrix className={cn(className, "text-foreground")} />
    case "qq":
      return <IconBrandQq className={cn(className, "text-blue-500")} />
    default:
      return <IconMessageCircle className={cn(className, "opacity-60")} />
  }
}

function getSessionSender(session: SessionSummary): string {
  // Never show person text for web sessions
  if (
    session.type === "web" ||
    !session.channel ||
    session.channel === "pico"
  ) {
    return ""
  }
  if (session.sender?.trim()) return session.sender.trim()
  if (session.chat?.trim()) return session.chat.trim()
  const id = session.id || ""
  const parts = id.split(":")
  if (parts.length >= 4) {
    const secondLast = parts[parts.length - 2].toLowerCase()
    if (secondLast === "direct" || secondLast === "group") {
      return parts[parts.length - 1]
    }
  }
  return ""
}

export function ChatHistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [senderQuery, setSenderQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedSender, setSelectedSender] = useState<string>("all")
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(
    null,
  )
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      return (
        (localStorage.getItem("picoclaw_history_view_mode") as
          "grid" | "list") || "grid"
      )
    } catch {
      return "grid"
    }
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const { activeSessionId, switchSession, newChat } = usePicoChat()

  const {
    sessions,
    hasMore,
    loadError,
    loadErrorMessage,
    observerRef,
    handleDeleteSession,
    handleClearAllSessions,
  } = useSessionHistory({
    activeSessionId,
    onDeletedActiveSession: newChat,
    limit: 50,
    sessionType: selectedType,
    sender:
      selectedSender !== "all"
        ? selectedSender
        : senderQuery.trim() || undefined,
    query: debouncedSearch || undefined,
  })

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode)
    try {
      localStorage.setItem("picoclaw_history_view_mode", mode)
    } catch {}
  }

  const sessionTypes = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      { id: "all", label: "All Sessions", count: sessions.length },
      {
        id: "web",
        label: "Web Chat",
        count: sessions.filter(
          (s) => s.type === "web" || !s.type || s.channel === "pico",
        ).length,
      },
    ]
    const channelMap = new Map<string, number>()
    for (const s of sessions) {
      const ch = s.channel?.toLowerCase().trim()
      if (ch && ch !== "pico") {
        channelMap.set(ch, (channelMap.get(ch) || 0) + 1)
      }
    }
    for (const [ch, count] of channelMap.entries()) {
      const label = ch.charAt(0).toUpperCase() + ch.slice(1)
      list.push({ id: `channel/${ch}`, label, count })
    }
    return list
  }, [sessions])

  const availableSenders = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      const matchesType =
        selectedType === "all" ||
        (selectedType === "web" &&
          (s.type === "web" || !s.type || s.channel === "pico")) ||
        (selectedType.startsWith("channel/") &&
          (s.type === selectedType ||
            s.channel === selectedType.replace("channel/", "")))
      if (!matchesType) continue

      const sender = getSessionSender(s)
      if (sender) {
        map.set(sender, (map.get(sender) || 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([sender, count]) => ({ sender, count }))
      .sort((a, b) => b.count - a.count)
  }, [sessions, selectedType])

  const showSenderFilter = selectedType !== "all" && selectedType !== "web"

  const filteredSessions = useMemo(() => {
    let list = sessions
    if (selectedType !== "all") {
      if (selectedType === "web") {
        list = list.filter(
          (s) => s.type === "web" || !s.type || s.channel === "pico",
        )
      } else if (selectedType.startsWith("channel/")) {
        const targetCh = selectedType.replace("channel/", "")
        list = list.filter(
          (s) => s.type === selectedType || s.channel === targetCh,
        )
      }
    }

    if (selectedSender !== "all") {
      list = list.filter((s) => {
        const sender = getSessionSender(s)
        return (
          sender === selectedSender ||
          s.sender === selectedSender ||
          s.chat === selectedSender
        )
      })
    }

    if (senderQuery.trim()) {
      const sq = senderQuery.toLowerCase().trim()
      list = list.filter((s) => {
        const sender = getSessionSender(s).toLowerCase()
        return (
          sender.includes(sq) ||
          (s.sender || "").toLowerCase().includes(sq) ||
          (s.chat || "").toLowerCase().includes(sq) ||
          (s.id || "").toLowerCase().includes(sq)
        )
      })
    }

    if (!debouncedSearch && search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.preview || "").toLowerCase().includes(q) ||
          (s.sender || "").toLowerCase().includes(q) ||
          (s.channel || "").toLowerCase().includes(q),
      )
    }
    return list
  }, [
    sessions,
    selectedType,
    selectedSender,
    senderQuery,
    search,
    debouncedSearch,
  ])

  const handleOpenSession = (sessionId: string) => {
    switchSession(sessionId)
    void navigate({ to: "/" })
  }

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      void navigate({ to: "/" })
    }
  }

  const handleCreateNewChat = () => {
    newChat()
    void navigate({ to: "/" })
  }

  const handleExportSession = async (session: SessionSummary) => {
    try {
      toast.loading("Exporting conversation...", { id: `export-${session.id}` })
      await exportSessionAsMarkdown(session)
      toast.success("Conversation exported successfully", {
        id: `export-${session.id}`,
      })
    } catch {
      toast.error("Failed to export conversation", {
        id: `export-${session.id}`,
      })
    }
  }

  const onConfirmClearAll = async () => {
    try {
      setIsClearing(true)
      await handleClearAllSessions(selectedType)
      toast.success(t("chat.historyCleared", "Chat history cleared"))
      setIsClearAllDialogOpen(false)
    } catch {
      toast.error(t("chat.clearFailed", "Failed to clear chat history"))
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* App Bar: Back button before title, title with session count, and Clear All + New Chat to the right */}
      <PageHeader
        title="Chat History"
        className="px-3 sm:px-6"
        beforeTitle={
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="mr-1 h-8 cursor-pointer gap-1.5 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
            title="Go back"
            aria-label="Go back"
          >
            <IconArrowLeft className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        }
        titleExtra={
          sessions.length > 0 ? (
            <Badge
              variant="secondary"
              className="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            >
              {sessions.length}
            </Badge>
          ) : undefined
        }
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearAllDialogOpen(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 h-8 cursor-pointer gap-1.5 px-2.5 text-xs font-medium sm:h-9 sm:px-3 sm:text-sm"
              title={
                selectedType === "all"
                  ? "Clear all history"
                  : `Clear ${selectedType.replace("channel/", "")} history`
              }
              aria-label="Clear chat history"
            >
              <IconTrash className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">
                {selectedType === "all" ? "Clear All" : "Clear Filtered"}
              </span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleCreateNewChat}
            className="bg-primary text-primary-foreground h-8 cursor-pointer gap-1.5 px-2.5 text-xs font-medium shadow-sm sm:h-9 sm:px-4 sm:text-sm"
            title="New Chat"
            aria-label="New Chat"
          >
            <IconPlus className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>
      </PageHeader>

      <div className="flex-1 space-y-3.5 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 md:px-8">
        {/* Session Type / Channel Filter Pills */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
          {sessionTypes.map((type) => {
            const isSelected = selectedType === type.id
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setSelectedType(type.id)
                  setSelectedSender("all")
                  setSenderQuery("")
                }}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted/60 border-border/60 hover:text-foreground"
                }`}
              >
                {type.id === "all" ? (
                  <IconMessageCircle className="size-3.5 opacity-80" />
                ) : type.id === "web" ? (
                  <IconWorld className="size-3.5 opacity-80" />
                ) : (
                  getSessionChannelIcon(
                    type.id.replace("channel/", ""),
                    "size-3.5",
                  )
                )}
                <span>{type.label}</span>
                {type.count > 0 && (
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] font-semibold ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {type.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search, Sender Filter & View Switcher Bar */}
        <div className="bg-card border-border/60 space-y-2.5 rounded-2xl border p-3 shadow-xs sm:p-3.5">
          <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[180px] flex-1">
              <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations by title or preview..."
                className="bg-muted/40 h-9 pr-8 pl-9 text-xs sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-md p-0.5"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Sender (Phone Number, Telegram Chat ID, Name) - only for channel views */}
            {showSenderFilter && (
              <div className="relative min-w-[180px] sm:w-64">
                <IconUser className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                <Input
                  value={senderQuery}
                  onChange={(e) => {
                    setSenderQuery(e.target.value)
                    setSelectedSender("all")
                  }}
                  placeholder="Filter by sender (number / chat ID)..."
                  className="bg-muted/40 h-9 pr-8 pl-8 font-mono text-xs sm:text-sm"
                />
                {senderQuery && (
                  <button
                    type="button"
                    onClick={() => setSenderQuery("")}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-md p-0.5"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Grid & List View Toggle Switcher */}
            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
              <div className="bg-muted/60 border-border/40 flex items-center rounded-lg border p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleViewModeChange("grid")}
                  title="Grid view"
                  className={cn(
                    "size-7 cursor-pointer rounded-md",
                    viewMode === "grid"
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <IconLayoutGrid className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleViewModeChange("list")}
                  title="List view"
                  className={cn(
                    "size-7 cursor-pointer rounded-md",
                    viewMode === "list"
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <IconLayoutList className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Sender Chips (when senders are detected and not all/web) */}
          {showSenderFilter && availableSenders.length > 0 && (
            <div className="no-scrollbar border-border/30 flex items-center gap-1.5 overflow-x-auto border-t pt-1.5">
              <span className="text-muted-foreground mr-0.5 flex shrink-0 items-center gap-1 text-[11px] font-medium">
                <IconFilter className="text-muted-foreground/80 size-3" />
                <span>Senders:</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setSelectedSender("all")
                  setSenderQuery("")
                }}
                className={`shrink-0 cursor-pointer rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-all ${
                  selectedSender === "all" && !senderQuery
                    ? "bg-secondary text-secondary-foreground border-secondary-foreground/20 font-semibold"
                    : "bg-card text-muted-foreground hover:bg-muted/60 border-border/50 hover:text-foreground"
                }`}
              >
                All
              </button>

              {availableSenders.map(({ sender, count }) => {
                const isSelected =
                  selectedSender === sender || senderQuery.trim() === sender
                return (
                  <button
                    key={sender}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSender("all")
                        setSenderQuery("")
                      } else {
                        setSelectedSender(sender)
                        setSenderQuery(sender)
                      }
                    }}
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-card text-muted-foreground hover:bg-muted/60 border-border/50 hover:text-foreground"
                    }`}
                  >
                    <span className="max-w-[140px] truncate sm:max-w-[200px]">
                      {sender}
                    </span>
                    <span
                      className={`py-0.2 rounded-full px-1 text-[9px] font-semibold ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Statistics Bar */}
          <div className="text-muted-foreground border-border/30 flex items-center justify-between border-t pt-1 text-xs">
            <span>
              Showing <strong>{filteredSessions.length}</strong> of{" "}
              <strong>{sessions.length}</strong> sessions
            </span>
          </div>
        </div>

        {loadError && (
          <div className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl border p-4 text-center text-xs">
            {loadErrorMessage}
          </div>
        )}

        {/* Sessions Content */}
        {filteredSessions.length === 0 && !loadError ? (
          <div className="space-y-3 py-16 text-center">
            <div className="bg-muted/70 text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-2xl">
              <IconMessageCircle className="size-6 opacity-60" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {search || senderQuery || selectedSender !== "all"
                  ? "No matching conversations found"
                  : "No chat history yet"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {search || senderQuery || selectedSender !== "all"
                  ? "Try searching for a different keyword or resetting sender filters"
                  : "Start a conversation to see your history recorded here."}
              </p>
            </div>
            {!search && !senderQuery && selectedSender === "all" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateNewChat}
                className="h-8 cursor-pointer gap-1.5 text-xs"
              >
                <IconPlus className="size-3.5" /> Start Conversation
              </Button>
            )}
          </div>
        ) : viewMode === "list" ? (
          /* List View */
          <div className="space-y-2">
            {filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId
              const sender = getSessionSender(session)

              return (
                <div
                  key={session.id}
                  onClick={() => handleOpenSession(session.id)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all sm:p-3.5",
                    isActive
                      ? "border-primary/50 bg-primary/5 ring-primary/20 ring-1"
                      : "border-border/60 hover:border-border hover:bg-muted/40 bg-card",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="bg-muted/60 flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9">
                      {session.type !== "web" &&
                      session.channel &&
                      session.channel !== "pico" ? (
                        getSessionChannelIcon(session.channel, "size-4")
                      ) : (
                        <IconMessageCircle className="size-4 opacity-60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-foreground group-hover:text-primary truncate text-sm font-semibold transition-colors">
                          {session.title || "Untitled Conversation"}
                        </h4>
                        {session.type !== "web" &&
                          session.channel &&
                          session.channel !== "pico" && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 px-1.5 py-0 text-[9px] font-semibold tracking-wider uppercase"
                            >
                              {session.channel}
                            </Badge>
                          )}
                        {sender && (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground hidden shrink-0 items-center gap-1 px-1.5 py-0 font-mono text-[10px] sm:inline-flex"
                          >
                            <IconUser className="size-2.5" />
                            <span>{sender}</span>
                          </Badge>
                        )}
                        {isActive && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary shrink-0 px-1.5 py-0 text-[10px]"
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                      {session.match_snippet ? (
                        <p
                          className="text-foreground/90 bg-primary/5 border-primary/20 [&>mark]:bg-primary/25 [&>mark]:text-primary max-w-2xl rounded-md border px-2.5 py-1 font-mono text-xs text-[11px] [&>mark]:rounded-xs [&>mark]:px-0.5 [&>mark]:font-semibold"
                          dangerouslySetInnerHTML={{
                            __html: session.match_snippet,
                          }}
                        />
                      ) : session.preview ? (
                        <p className="text-muted-foreground max-w-2xl truncate text-xs">
                          {session.preview}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-muted-foreground flex shrink-0 items-center gap-2.5 text-xs sm:gap-3">
                    <span className="hidden md:inline">
                      {t("chat.messagesCount", {
                        count: session.message_count,
                      })}
                    </span>
                    <span className="hidden md:inline">•</span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <IconClock className="size-3" />
                      {dayjs(session.updated).fromNow()}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground size-7 cursor-pointer opacity-80 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconDotsVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleExportSession(session)
                          }}
                          className="cursor-pointer gap-2 text-xs"
                        >
                          <IconDownload className="size-3.5" />
                          <span>Export</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setSessionToDelete(session)
                          }}
                          className="text-destructive focus:text-destructive cursor-pointer gap-2 text-xs"
                        >
                          <IconTrash className="size-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId
              const sender = getSessionSender(session)

              return (
                <Card
                  key={session.id}
                  className={`group relative cursor-pointer border transition-all duration-200 hover:shadow-md ${
                    isActive
                      ? "border-primary/50 bg-primary/5 ring-primary/20 ring-1"
                      : "border-border/60 hover:border-border hover:bg-muted/40"
                  }`}
                  onClick={() => handleOpenSession(session.id)}
                >
                  <CardContent className="flex h-full flex-col justify-between space-y-3 p-3.5 sm:p-4">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {session.type !== "web" &&
                          session.channel &&
                          session.channel !== "pico" ? (
                            getSessionChannelIcon(
                              session.channel,
                              "size-4 shrink-0",
                            )
                          ) : (
                            <IconMessageCircle className="size-4 shrink-0 opacity-60" />
                          )}
                          <h4 className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors">
                            {session.title || "Untitled Conversation"}
                          </h4>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {session.type !== "web" &&
                            session.channel &&
                            session.channel !== "pico" && (
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[9px] font-semibold tracking-wider uppercase"
                              >
                                {session.channel}
                              </Badge>
                            )}
                          {isActive && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 text-primary shrink-0 px-1.5 py-0 text-[10px]"
                            >
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>

                      {sender && (
                        <div className="text-muted-foreground/90 flex items-center gap-1 font-mono text-[11px]">
                          <IconUser className="text-muted-foreground/60 size-3" />
                          <span className="truncate">{sender}</span>
                        </div>
                      )}

                      {session.match_snippet ? (
                        <p
                          className="text-foreground/90 bg-primary/5 border-primary/20 [&>mark]:bg-primary/25 [&>mark]:text-primary line-clamp-2 rounded-md border px-2 py-1 font-mono text-[11px] [&>mark]:rounded-xs [&>mark]:px-0.5 [&>mark]:font-semibold"
                          dangerouslySetInnerHTML={{
                            __html: session.match_snippet,
                          }}
                        />
                      ) : session.preview ? (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {session.preview}
                        </p>
                      ) : null}
                    </div>

                    <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span>
                          {t("chat.messagesCount", {
                            count: session.message_count,
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <IconClock className="size-3" />
                          {dayjs(session.updated).fromNow()}
                        </span>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground size-7 cursor-pointer opacity-80 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleExportSession(session)
                            }}
                            className="cursor-pointer gap-2 text-xs"
                          >
                            <IconDownload className="size-3.5" />
                            <span>Export</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setSessionToDelete(session)
                            }}
                            className="text-destructive focus:text-destructive cursor-pointer gap-2 text-xs"
                          >
                            <IconTrash className="size-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {hasMore && sessions.length > 0 && (
          <div ref={observerRef} className="py-4 text-center">
            <span className="text-muted-foreground animate-pulse text-xs">
              {t("chat.loadingMore")}
            </span>
          </div>
        )}
      </div>

      {/* Delete Single Conversation Confirmation Dialog */}
      <AlertDialog
        open={Boolean(sessionToDelete)}
        onOpenChange={() => setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconTrash className="text-destructive size-5" />
              Delete Conversation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {sessionToDelete?.title || "this chat"}&quot;? All messages in
              this session will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionToDelete) {
                  void handleDeleteSession(sessionToDelete.id)
                  setSessionToDelete(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Sessions Confirmation Dialog */}
      <AlertDialog
        open={isClearAllDialogOpen}
        onOpenChange={setIsClearAllDialogOpen}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedType === "all"
                ? "This will permanently delete all chat history across all session types. This action cannot be undone."
                : `This will permanently delete all ${selectedType.replace("channel/", "")} chat history. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmClearAll}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear History"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
