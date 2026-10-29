import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconAtom,
  IconBrandDiscord,
  IconBrandLine,
  IconBrandMatrix,
  IconBrandQq,
  IconBrandSlack,
  IconBrandTelegram,
  IconBrandWechat,
  IconBrandWhatsapp,
  IconCheck,
  IconChevronRight,
  IconChevronsDown,
  IconChevronsUp,
  IconClock,
  IconDotsVertical,
  IconDownload,
  IconFilter,
  IconKey,
  IconLayoutDashboard,
  IconListDetails,
  IconMessageCircle,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTools,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { exportSessionAsMarkdown } from "@/api/sessions"
import { SidebarNavFooter } from "@/components/sidebar-nav-footer"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { usePicoChat } from "@/hooks/use-pico-chat"
import { useSessionHistory } from "@/hooks/use-session-history"
import { useSidebarChannels } from "@/hooks/use-sidebar-channels"
import { cn } from "@/lib/utils"

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

function renderSidebarMatchSnippet(
  snippet?: string,
  preview?: string,
  query?: string,
) {
  if (snippet) {
    const cleaned = snippet.replace(/<\/?[^>]+(>|$)/g, (match) =>
      match === "<b>" ||
      match === "</b>" ||
      match === "<mark>" ||
      match === "</mark>"
        ? match
        : "",
    )
    const html = cleaned
      .replace(
        /<b>/g,
        '<mark class="bg-primary/25 text-primary font-semibold px-0.5 rounded-2xs">',
      )
      .replace(/<\/b>/g, "</mark>")
      .replace(
        /<mark>/g,
        '<mark class="bg-primary/25 text-primary font-semibold px-0.5 rounded-2xs">',
      )
    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  if (preview && query && query.trim()) {
    const q = query.trim().toLowerCase()
    const lower = preview.toLowerCase()
    const idx = lower.indexOf(q)
    if (idx !== -1) {
      const start = Math.max(0, idx - 18)
      const end = Math.min(preview.length, idx + q.length + 30)
      const prefix = start > 0 ? "..." : ""
      const suffix = end < preview.length ? "..." : ""
      const before = preview.slice(start, idx)
      const match = preview.slice(idx, idx + q.length)
      const after = preview.slice(idx + q.length, end)
      return (
        <span>
          {prefix}
          {before}
          <mark className="bg-primary/25 text-primary rounded-2xs px-0.5 font-semibold">
            {match}
          </mark>
          {after}
          {suffix}
        </span>
      )
    }
    return <span>{preview.slice(0, 45)}</span>
  }

  return null
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const routerState = useRouterState()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isMobile, setOpenMobile, setOpen } = useSidebar()
  const currentPath = routerState.location.pathname
  const [searchQuery, setSearchQuery] = React.useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("")
  const [selectedSessionType, setSelectedSessionType] =
    React.useState<string>("all")
  const [isClearDialogOpen, setIsClearDialogOpen] = React.useState(false)
  const [isClearing, setIsClearing] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { activeSessionId, switchSession, newChat } = usePicoChat()

  const { sessions, handleDeleteSession, handleClearAllSessions } =
    useSessionHistory({
      activeSessionId,
      onDeletedActiveSession: newChat,
      limit: 50,
      sessionType: selectedSessionType,
      query: debouncedSearchQuery || undefined,
    })

  const {
    channelItems,
    hasMoreChannels,
    showAllChannels,
    toggleShowAllChannels,
  } = useSidebarChannels({
    language: (i18n.resolvedLanguage ?? i18n.language ?? "").toLowerCase(),
    t,
  })

  const sessionTypes = React.useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      {
        id: "all",
        label: t("navigation.all_sessions", "All"),
        count: sessions.length,
      },
      {
        id: "web",
        label: t("navigation.web_sessions", "Web"),
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
  }, [sessions, t])

  const onConfirmClearHistory = async () => {
    try {
      setIsClearing(true)
      await handleClearAllSessions(selectedSessionType)
      toast.success(t("chat.historyCleared", "Chat history cleared"))
      setIsClearDialogOpen(false)
    } catch {
      toast.error(t("chat.clearFailed", "Failed to clear chat history"))
    } finally {
      setIsClearing(false)
    }
  }

  const isSettingsMode =
    currentPath.startsWith("/models") ||
    currentPath.startsWith("/credentials") ||
    currentPath.startsWith("/channels") ||
    currentPath.startsWith("/agent") ||
    currentPath.startsWith("/config") ||
    currentPath.startsWith("/logs") ||
    currentPath.startsWith("/settings") ||
    currentPath.startsWith("/more")

  const handleNavItemClick = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  const handleOpenSession = React.useCallback(
    (sessionId: string) => {
      switchSession(sessionId)
      if (currentPath !== "/" && currentPath !== "/chat") {
        void navigate({ to: "/" })
      }
      if (isMobile) {
        setOpenMobile(false)
      }
    },
    [currentPath, isMobile, navigate, setOpenMobile, switchSession],
  )

  const filteredSessions = React.useMemo(() => {
    let list = sessions
    if (selectedSessionType !== "all") {
      if (selectedSessionType === "web") {
        list = list.filter(
          (s) => s.type === "web" || !s.type || s.channel === "pico",
        )
      } else if (selectedSessionType.startsWith("channel/")) {
        const targetCh = selectedSessionType.replace("channel/", "")
        list = list.filter(
          (s) => s.type === selectedSessionType || s.channel === targetCh,
        )
      }
    }
    if (!debouncedSearchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.preview || "").toLowerCase().includes(q),
      )
    }
    return list.slice(0, 50)
  }, [sessions, selectedSessionType, searchQuery, debouncedSearchQuery])

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="bg-background border-r-border/20 border-r"
    >
      <SidebarHeader className="flex h-14 items-center justify-between px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/"
          className="flex items-center overflow-hidden rounded-xl p-1 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 hover:opacity-85"
        >
          <img
            src="/favicon.svg"
            alt="PicoClaw"
            className="hidden size-7 shrink-0 transition-transform group-data-[collapsible=icon]:block hover:scale-105"
          />
          <img
            src="/logo_with_text.png"
            alt="PicoClaw"
            className="h-7 w-auto max-w-[145px] shrink-0 object-contain group-data-[collapsible=icon]:hidden"
          />
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="bg-border/50 mx-2 my-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

      <SidebarContent className="bg-background flex min-h-0 flex-col">
        {!isSettingsMode ? (
          /* ==================== HOME / WORKSPACE VIEW ==================== */
          <>
            <SidebarGroup className="shrink-0 px-2 py-1.5">
              <SidebarGroupLabel className="text-muted-foreground/70 px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t("navigation.workspace", "Workspace")}
              </SidebarGroupLabel>

              <SidebarGroupContent className="pt-0.5">
                <SidebarMenu>
                  {/* Dashboard */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/dashboard" ||
                        currentPath.startsWith("/dashboard/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.dashboard", "Dashboard")}
                      className={`h-9 px-3 ${currentPath === "/dashboard" ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/dashboard">
                        <IconLayoutDashboard className="size-5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.dashboard", "Dashboard")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Chat */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={currentPath === "/" || currentPath === "/chat"}
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.chat", "Chat")}
                      className={`h-9 px-3 ${currentPath === "/" || currentPath === "/chat" ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/">
                        <IconMessageCircle className="size-5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.chat", "Chat")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Automations */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/automations" ||
                        currentPath.startsWith("/automations/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.automations", "Automations")}
                      className={`h-9 px-3 ${currentPath === "/automations" ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/automations">
                        <IconClock className="size-5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.automations", "Automations")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* More -> default opens /models in Settings */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.more", "More")}
                      className="text-muted-foreground hover:bg-muted/60 h-9 px-3"
                    >
                      <Link to="/models">
                        <IconAdjustmentsHorizontal className="size-5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.more", "More")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-border/50 mx-2 my-1 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

            {/* Chat History Section */}
            <SidebarGroup className="flex min-h-0 flex-1 flex-col px-2 py-1">
              <SidebarGroupLabel className="text-muted-foreground/70 flex items-center justify-between px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                <span>{t("navigation.chat_history", "Chat History")}</span>
                {filteredSessions.length > 0 && (
                  <span className="text-muted-foreground/50 text-[10px] font-normal">
                    {filteredSessions.length}
                  </span>
                )}
              </SidebarGroupLabel>

              {/* Icon Mode: Search Icon Button Only */}
              <div className="hidden justify-center py-1 group-data-[collapsible=icon]:flex">
                <SidebarMenuButton
                  tooltip={t("navigation.search_chats", "Search chat history")}
                  onClick={() => {
                    setOpen(true)
                    if (isMobile) setOpenMobile(true)
                    setTimeout(() => searchInputRef.current?.focus(), 150)
                  }}
                  className="text-muted-foreground hover:bg-muted/60 hover:text-foreground size-9 justify-center p-0"
                >
                  <IconSearch className="size-4.5" />
                </SidebarMenuButton>
              </div>

              {/* Search & Filter Bar */}
              <div className="shrink-0 space-y-1 px-1 py-1 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex min-w-0 flex-1 items-center">
                    <IconSearch className="text-muted-foreground pointer-events-none absolute left-2.5 size-3.5" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t(
                        "navigation.search_chats",
                        "Search chats...",
                      )}
                      className="bg-muted/40 border-border/40 focus:bg-background focus:ring-ring text-foreground placeholder:text-muted-foreground/60 h-7 w-full rounded-md border pr-6 pl-8 text-xs transition-colors focus:ring-1 focus:outline-hidden"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-muted-foreground hover:text-foreground absolute right-1.5 cursor-pointer rounded-sm p-0.5"
                        aria-label="Clear search"
                      >
                        <IconX className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter icon popup defaulting to all */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "relative size-7 shrink-0 cursor-pointer rounded-md",
                          selectedSessionType !== "all"
                            ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        title={
                          selectedSessionType === "all"
                            ? "Filter sessions (All)"
                            : `Filtered: ${selectedSessionType.replace("channel/", "")}`
                        }
                        aria-label="Filter sessions"
                      >
                        <IconFilter className="size-3.5" />
                        {selectedSessionType !== "all" && (
                          <span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1">
                      <div className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wider uppercase">
                        {t("chat.filterByChannel", "Filter by Channel")}
                      </div>
                      {sessionTypes.map((type) => {
                        const isSelected = selectedSessionType === type.id
                        return (
                          <DropdownMenuItem
                            key={type.id}
                            onClick={() => setSelectedSessionType(type.id)}
                            className={cn(
                              "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs",
                              isSelected &&
                                "bg-accent text-accent-foreground font-medium",
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {type.id === "all" ? (
                                <IconMessageCircle className="size-3.5 opacity-60" />
                              ) : type.id === "web" ? (
                                <IconWorld className="size-3.5 text-blue-500 opacity-80" />
                              ) : (
                                getSessionChannelIcon(
                                  type.id.replace("channel/", ""),
                                  "size-3.5",
                                )
                              )}
                              <span className="truncate">{type.label}</span>
                            </span>
                            <div className="ml-2 flex shrink-0 items-center gap-1.5">
                              {type.count > 0 && (
                                <span className="text-muted-foreground font-mono text-[10px]">
                                  {type.count}
                                </span>
                              )}
                              {isSelected && (
                                <IconCheck className="text-primary size-3.5" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Active filter badge when not all */}
                {selectedSessionType !== "all" && (
                  <div className="text-muted-foreground flex items-center justify-between px-1 text-[11px]">
                    <span className="flex items-center gap-1 truncate">
                      <span>Filter:</span>
                      <span className="text-foreground font-semibold capitalize">
                        {selectedSessionType === "web"
                          ? "Web Chat"
                          : selectedSessionType.replace("channel/", "")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSessionType("all")}
                      className="text-primary flex cursor-pointer items-center gap-0.5 text-[10px] hover:underline"
                    >
                      <span>Reset</span>
                      <IconX className="size-2.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded Mode: 50 Chat Sessions List */}
              <div className="no-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto pt-1 group-data-[collapsible=icon]:hidden">
                <SidebarMenu>
                  {filteredSessions.length === 0 ? (
                    <div className="text-muted-foreground/60 px-3 py-6 text-center text-xs">
                      {searchQuery
                        ? t("navigation.no_chats_found", "No chats found")
                        : "No recent chats"}
                    </div>
                  ) : (
                    filteredSessions.map((session) => {
                      const isActive =
                        session.id === activeSessionId &&
                        (currentPath === "/" || currentPath === "/chat")
                      const isChannel =
                        session.type !== "web" &&
                        session.channel &&
                        session.channel !== "pico"
                      const matchSubtext =
                        searchQuery.trim() || session.match_snippet
                          ? renderSidebarMatchSnippet(
                              session.match_snippet,
                              session.preview,
                              searchQuery,
                            )
                          : null

                      return (
                        <SidebarMenuItem
                          key={session.id}
                          className="group/item relative"
                        >
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`w-full rounded-md px-2.5 text-xs transition-colors ${
                              matchSubtext ? "h-auto py-1.5" : "h-8"
                            } ${
                              isActive
                                ? "bg-accent/80 text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                            onClick={() => handleOpenSession(session.id)}
                          >
                            <button
                              type="button"
                              className="flex w-full min-w-0 flex-col text-left"
                            >
                              <div className="flex w-full min-w-0 items-center gap-2">
                                {isChannel ? (
                                  getSessionChannelIcon(
                                    session.channel,
                                    "size-3.5 shrink-0",
                                  )
                                ) : (
                                  <IconMessageCircle
                                    className={`size-3.5 shrink-0 ${isActive ? "text-primary" : "opacity-60"}`}
                                  />
                                )}
                                <span className="min-w-0 flex-1 truncate pr-1">
                                  {session.title || "Untitled chat"}
                                </span>
                                {isChannel && (
                                  <span className="py-0.2 bg-muted/80 text-muted-foreground ml-1 shrink-0 rounded px-1 text-[9px] font-semibold tracking-wider uppercase">
                                    {session.channel}
                                  </span>
                                )}
                              </div>
                              {matchSubtext && (
                                <div className="text-muted-foreground/80 line-clamp-1 w-full min-w-0 truncate pl-5.5 font-mono text-[10px]">
                                  {matchSubtext}
                                </div>
                              )}
                            </button>
                          </SidebarMenuButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                title="Chat options"
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                                className="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1 opacity-0 transition-all group-hover/item:opacity-70 hover:opacity-100! focus:opacity-100"
                              >
                                <IconDotsVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    toast.loading("Exporting chat...", {
                                      id: `export-${session.id}`,
                                    })
                                    await exportSessionAsMarkdown(session)
                                    toast.success(
                                      "Chat exported successfully",
                                      { id: `export-${session.id}` },
                                    )
                                  } catch {
                                    toast.error("Failed to export chat", {
                                      id: `export-${session.id}`,
                                    })
                                  }
                                }}
                                className="cursor-pointer gap-2 text-xs"
                              >
                                <IconDownload className="size-3.5" />
                                <span>Export</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleDeleteSession(session.id)
                                }}
                                className="text-destructive focus:text-destructive cursor-pointer gap-2 text-xs"
                              >
                                <IconTrash className="size-3.5" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      )
                    })
                  )}
                </SidebarMenu>
              </div>

              {/* View More Option */}
              <div className="border-border/30 mt-auto shrink-0 border-t px-1 pt-1.5 pb-1 group-data-[collapsible=icon]:hidden">
                <SidebarMenuButton
                  asChild
                  onClick={handleNavItemClick}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 h-7 w-full justify-between px-2 text-xs"
                >
                  <Link to="/chat-history">
                    <span className="flex items-center gap-1.5">
                      <IconClock className="size-3.5 opacity-70" />
                      <span>{t("navigation.view_more", "View more")}</span>
                    </span>
                    <IconChevronRight className="size-3 opacity-60" />
                  </Link>
                </SidebarMenuButton>
              </div>
            </SidebarGroup>
          </>
        ) : (
          /* ==================== SETTINGS SCREEN NAV BAR ==================== */
          <div className="flex flex-col gap-1 py-1">
            {/* Back to Chat header button */}
            <div className="shrink-0 px-2 pt-1 pb-1">
              <SidebarMenuButton
                asChild
                onClick={handleNavItemClick}
                tooltip={t("navigation.chat", "Back to Chat")}
                className="bg-muted/60 hover:bg-muted text-foreground border-border/40 h-8.5 gap-2 rounded-lg border px-2.5 text-xs font-medium"
              >
                <Link to="/">
                  <IconArrowLeft className="text-primary size-4 shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    Back to Chat
                  </span>
                </Link>
              </SidebarMenuButton>
            </div>

            <SidebarSeparator className="bg-border/50 mx-2 my-0.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

            {/* Models Group */}
            <SidebarGroup className="px-2 py-0.5">
              <SidebarGroupLabel className="text-muted-foreground/70 px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t("navigation.model_group", "Models")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="pt-0.5">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/models" ||
                        currentPath.startsWith("/models/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.models", "Models")}
                      className={`h-8.5 px-3 ${currentPath === "/models" ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/models">
                        <IconAtom className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.models", "Models")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/credentials" ||
                        currentPath.startsWith("/credentials/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.credentials", "Credentials")}
                      className={`h-8.5 px-3 ${currentPath === "/credentials" ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/credentials">
                        <IconKey className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.credentials", "Credentials")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-border/50 mx-2 my-0.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

            {/* Channels Group */}
            <SidebarGroup className="px-2 py-0.5">
              <SidebarGroupLabel className="text-muted-foreground/70 px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t("navigation.channels_group", "Channels")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="pt-0.5">
                <SidebarMenu>
                  {channelItems.map((item) => {
                    const isActive =
                      currentPath === item.url ||
                      currentPath.startsWith(`${item.url}/`)
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          onClick={handleNavItemClick}
                          tooltip={item.title}
                          className={`h-8.5 px-3 ${isActive ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                        >
                          <Link to={item.url}>
                            <item.icon
                              className={`size-4.5 shrink-0 p-0.5 ${isActive ? "opacity-100" : "opacity-75"}`}
                            />
                            <span
                              className={
                                isActive ? "opacity-100" : "opacity-80"
                              }
                            >
                              {item.title}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                  {hasMoreChannels && (
                    <SidebarMenuItem key="channels-toggle">
                      <SidebarMenuButton
                        onClick={toggleShowAllChannels}
                        className="text-muted-foreground hover:bg-muted/60 h-8 px-3"
                      >
                        {showAllChannels ? (
                          <IconChevronsUp className="size-4 p-0.5 opacity-70" />
                        ) : (
                          <IconChevronsDown className="size-4 p-0.5 opacity-70" />
                        )}
                        <span className="text-xs opacity-80">
                          {showAllChannels
                            ? t("navigation.show_less_channels")
                            : t("navigation.show_more_channels")}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-border/50 mx-2 my-0.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

            {/* Agent Group */}
            <SidebarGroup className="px-2 py-0.5">
              <SidebarGroupLabel className="text-muted-foreground/70 px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t("navigation.agent_group", "Agent")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="pt-0.5">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/agent/hub" ||
                        currentPath.startsWith("/agent/hub/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.hub", "Hub")}
                      className={`h-8.5 px-3 ${currentPath.startsWith("/agent/hub") ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/agent/hub">
                        <IconSearch className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.hub", "Hub")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/agent/skills" ||
                        currentPath.startsWith("/agent/skills/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.skills", "Skills")}
                      className={`h-8.5 px-3 ${currentPath.startsWith("/agent/skills") ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/agent/skills">
                        <IconSparkles className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.skills", "Skills")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/agent/tools" ||
                        currentPath.startsWith("/agent/tools/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.tools", "Tools")}
                      className={`h-8.5 px-3 ${currentPath.startsWith("/agent/tools") ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/agent/tools">
                        <IconTools className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.tools", "Tools")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="bg-border/50 mx-2 my-0.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" />

            {/* Services Group */}
            <SidebarGroup className="px-2 py-0.5">
              <SidebarGroupLabel className="text-muted-foreground/70 px-2 py-1 text-xs font-semibold tracking-wider uppercase select-none group-data-[collapsible=icon]:hidden">
                {t("navigation.services", "Services")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="pt-0.5">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/config" ||
                        currentPath.startsWith("/config/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.config", "Config")}
                      className={`h-8.5 px-3 ${currentPath.startsWith("/config") ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/config">
                        <IconSettings className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.config", "Config")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        currentPath === "/logs" ||
                        currentPath.startsWith("/logs/")
                      }
                      onClick={handleNavItemClick}
                      tooltip={t("navigation.logs", "Logs")}
                      className={`h-8.5 px-3 ${currentPath.startsWith("/logs") ? "bg-accent/80 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    >
                      <Link to="/logs">
                        <IconListDetails className="size-4.5 shrink-0 p-0.5" />
                        <span className="opacity-90">
                          {t("navigation.logs", "Logs")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}
      </SidebarContent>

      <SidebarNavFooter />
      <SidebarRail />

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("chat.clearHistoryTitle", "Clear Chat History?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSessionType === "all"
                ? t(
                    "chat.clearAllHistoryDesc",
                    "This will permanently delete all chat history across all session types. This action cannot be undone.",
                  )
                : t(
                    "chat.clearFilteredHistoryDesc",
                    "This will permanently delete all {{type}} chat history. This action cannot be undone.",
                    {
                      type: selectedSessionType.replace("channel/", ""),
                    },
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmClearHistory}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing
                ? t("common.clearing", "Clearing...")
                : t("chat.clearHistory", "Clear History")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
