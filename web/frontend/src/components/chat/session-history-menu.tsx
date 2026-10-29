import {
  IconArrowRight,
  IconChevronDown,
  IconClock,
  IconHistory,
  IconMessageCircle,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { type RefObject, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { SessionSummary } from "@/api/sessions"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

dayjs.extend(relativeTime)

interface SessionHistoryMenuProps {
  sessions: SessionSummary[]
  activeSessionId: string
  hasMore: boolean
  loadError: boolean
  loadErrorMessage: string
  observerRef: RefObject<HTMLDivElement | null>
  onOpenChange: (open: boolean) => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  trigger?: React.ReactNode
}

export function SessionHistoryMenu({
  sessions,
  activeSessionId,
  hasMore,
  loadError,
  loadErrorMessage,
  observerRef,
  onOpenChange,
  onSwitchSession,
  onDeleteSession,
  trigger,
}: SessionHistoryMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [sessionToDelete, setSessionToDelete] = useState<SessionSummary | null>(
    null,
  )

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange(nextOpen)
  }

  // Support Cmd/Ctrl+K shortcut to open history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        handleOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q),
    )
  }, [sessions, search])

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || (
            <button
              type="button"
              className="group xs:max-w-[200px] border-border/60 bg-muted/30 hover:bg-muted/65 text-muted-foreground hover:text-foreground hover:border-border/90 flex h-9 w-full max-w-[150px] cursor-pointer items-center justify-between gap-2 rounded-full border px-3 text-xs shadow-2xs transition-all sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg"
              title={
                activeSession?.title
                  ? `Session: ${activeSession.title}`
                  : t("chat.history", "History")
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <IconHistory className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
                <span className="text-foreground/90 truncate text-left font-medium">
                  {activeSession?.title || t("chat.history", "History")}
                </span>
              </div>
              <div className="text-muted-foreground/60 flex shrink-0 items-center gap-1.5">
                <span className="text-muted-foreground/50 hidden text-[11px] font-normal sm:inline-flex">
                  Search
                </span>
                <kbd className="border-border/60 bg-background/80 text-muted-foreground/70 hidden h-4 items-center rounded border px-1 font-mono text-[9px] lg:inline-flex">
                  ⌘K
                </kbd>
                <IconChevronDown className="size-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          )}
        </DialogTrigger>
        <DialogContent className="border-border/80 bg-background/98 flex max-h-[85vh] w-[94vw] flex-col gap-3.5 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:max-w-xl sm:p-6 md:max-w-2xl lg:max-w-3xl">
          <DialogHeader className="border-border/40 gap-2.5 border-b pb-2">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 text-primary shrink-0 rounded-xl p-2">
                <IconHistory className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-foreground text-base font-semibold sm:text-lg">
                  {t("chat.history", "Chat History")}
                </DialogTitle>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {sessions.length}{" "}
                  {sessions.length === 1 ? "conversation" : "conversations"}{" "}
                  recorded
                </p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mt-1 w-full">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations by title or topic..."
                className="bg-muted/40 border-border/60 h-9 rounded-xl pl-9 text-xs sm:text-sm"
              />
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] flex-1 pr-2">
            {loadError && (
              <div className="text-destructive py-6 text-center text-xs">
                {loadErrorMessage}
              </div>
            )}

            {filteredSessions.length === 0 && !loadError ? (
              <div className="text-muted-foreground space-y-2 py-12 text-center text-xs sm:text-sm">
                <IconMessageCircle className="text-muted-foreground mx-auto size-8 opacity-40" />
                <p className="text-foreground/80 font-medium">
                  {search
                    ? "No matching conversations found"
                    : t("chat.noHistory", "No conversation history yet")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {search
                    ? "Try searching with different keywords"
                    : "Start a new chat to begin"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all",
                        isActive
                          ? "border-primary/50 bg-primary/5 dark:bg-primary/10 ring-primary/20 shadow-xs ring-1"
                          : "border-border/40 bg-card/60 hover:bg-muted/50 hover:border-border/70",
                      )}
                      onClick={() => {
                        onSwitchSession(session.id)
                        setOpen(false)
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            "shrink-0 rounded-lg p-2 transition-colors",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          <IconMessageCircle className="size-4" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground truncate text-xs font-semibold sm:text-sm">
                              {session.title || "Untitled Conversation"}
                            </span>
                            {isActive && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary shrink-0 px-1.5 py-0 text-[10px] font-medium"
                              >
                                Active
                              </Badge>
                            )}
                          </div>
                          {session.preview && (
                            <p className="text-muted-foreground/85 truncate text-[11px]">
                              {session.preview}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <Badge
                          variant="secondary"
                          className="text-muted-foreground hidden px-2 py-0.5 text-[10px] font-normal sm:inline-flex"
                        >
                          {t("chat.messagesCount", {
                            count: session.message_count,
                          })}
                        </Badge>

                        <span className="xs:flex text-muted-foreground hidden items-center gap-1 font-mono text-[11px]">
                          <IconClock className="size-3" />
                          {dayjs(session.updated).fromNow()}
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("chat.deleteSession")}
                          className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive size-7 rounded-lg opacity-60 transition-all hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSessionToDelete(session)
                          }}
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {hasMore && sessions.length > 0 && (
                  <div ref={observerRef} className="py-2 text-center">
                    <span className="text-muted-foreground animate-pulse text-xs">
                      {t("chat.loadingMore")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="border-border/40 flex items-center justify-between border-t pt-2.5 text-xs">
            <Button
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5 rounded-lg text-xs"
              onClick={() => {
                void navigate({ to: "/chat-history" })
                setOpen(false)
              }}
            >
              <span>View All History</span>
              <IconArrowRight className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 cursor-pointer text-xs"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete session confirm dialog */}
      <AlertDialog
        open={Boolean(sessionToDelete)}
        onOpenChange={() => setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconTrash className="text-destructive size-5" />
              Delete Chat Session
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {sessionToDelete?.title || "this chat"}&quot;? This will remove
              all messages in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionToDelete) {
                  onDeleteSession(sessionToDelete.id)
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
    </>
  )
}
