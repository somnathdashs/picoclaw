import {
  IconArrowRight,
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconHistory,
  IconMessageCircle,
  IconTrash,
} from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import type { SessionSummary } from "@/api/sessions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

dayjs.extend(relativeTime)

interface RecentChatsTrayProps {
  sessions: SessionSummary[]
  activeSessionId: string
  isExpanded: boolean
  onToggleExpand: () => void
  onSwitchSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => Promise<void>
}

export function RecentChatsTray({
  sessions,
  activeSessionId,
  isExpanded,
  onToggleExpand,
  onSwitchSession,
  onDeleteSession,
}: RecentChatsTrayProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const trayRef = useRef<HTMLDivElement>(null)

  // Close floating recent list when clicking outside or pressing Escape
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        onToggleExpand()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleExpand()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isExpanded, onToggleExpand])

  if (sessions.length === 0) {
    return null
  }

  const latestSession = sessions[0]

  return (
    <div ref={trayRef} className="relative w-full">
      {/* Floating expanded recent chats list overlay (chatbox stays pinned in place) */}
      {isExpanded && (
        <div className="border-border/70 bg-card/98 animate-in fade-in slide-in-from-bottom-2 absolute inset-x-0 bottom-full z-50 mb-2 flex flex-col rounded-2xl border p-3 shadow-xl backdrop-blur-xl duration-150">
          <div className="border-border/40 mb-1 flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <IconHistory className="text-primary size-4 shrink-0" />
              <span className="text-foreground text-xs font-semibold sm:text-sm">
                Recent Conversations
              </span>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-normal"
              >
                {sessions.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="text-muted-foreground hover:text-foreground h-6 gap-1 px-2 text-xs font-medium"
              >
                <IconChevronDown className="size-3.5" />
                <span>Collapse</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate({ to: "/chat-history" })}
                className="text-primary hover:text-primary/80 h-6 gap-1 px-2 text-xs font-medium"
              >
                <span>View All</span>
                <IconArrowRight className="size-3" />
              </Button>
            </div>
          </div>

          {/* Clean vertical list format */}
          <div className="divide-border/30 max-h-72 divide-y overflow-y-auto pr-1 sm:max-h-80">
            {sessions.slice(0, 40).map((session) => {
              const isActive = session.id === activeSessionId
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSwitchSession(session.id)
                    onToggleExpand()
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSwitchSession(session.id)
                      onToggleExpand()
                    }
                  }}
                  className={cn(
                    "group focus-visible:bg-muted/70 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60 text-foreground",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div
                      className={cn(
                        "shrink-0 rounded-lg p-1.5 transition-colors",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                      )}
                    >
                      <IconMessageCircle className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium sm:text-sm">
                          {session.title || "Untitled Conversation"}
                        </span>
                        {isActive && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 text-primary px-1 py-0 text-[9px] font-normal"
                          >
                            Active
                          </Badge>
                        )}
                      </div>
                      {session.preview && (
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {session.preview}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-border/50 text-muted-foreground hidden px-1.5 py-0 text-[10px] font-normal sm:inline-flex"
                    >
                      {t("chat.messagesCount", {
                        count: session.message_count,
                      })}
                    </Badge>

                    <span className="text-muted-foreground flex items-center gap-1 text-[10px] sm:text-[11px]">
                      <IconClock className="size-3" />
                      {dayjs(session.updated).fromNow()}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/15 size-6 opacity-60 transition-opacity hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onDeleteSession(session.id)
                      }}
                      aria-label="Delete session"
                    >
                      <IconTrash className="size-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Docked trigger bar below the chatbox */}
      <div className="border-border/40 bg-card/60 hover:border-border/70 flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-1 text-[11px] backdrop-blur-sm transition-colors">
        <button
          type="button"
          onClick={onToggleExpand}
          className="focus-visible:ring-primary flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:ring-1 focus-visible:outline-none"
          aria-label={
            isExpanded ? "Collapse recent chats" : "Expand recent chats"
          }
          aria-expanded={isExpanded}
        >
          <IconHistory className="text-primary size-3.5 shrink-0" />
          <span className="text-foreground shrink-0 font-medium">
            Recent Chats
          </span>
          <Badge
            variant="secondary"
            className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
          >
            {sessions.length}
          </Badge>

          {latestSession && (
            <span className="text-muted-foreground hidden max-w-[280px] truncate text-[11px] sm:inline-block md:max-w-[420px]">
              • Latest: {latestSession.title || "Untitled Conversation"}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground h-6 gap-1 px-2 text-[11px] font-medium"
          >
            {isExpanded ? (
              <>
                <IconChevronDown className="size-3" />
                <span>Close</span>
              </>
            ) : (
              <>
                <IconChevronUp className="size-3" />
                <span>Expand</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate({ to: "/chat-history" })}
            className="text-primary hover:text-primary/80 h-6 gap-1 px-2 text-[11px] font-medium"
          >
            <span className="xs:inline hidden">All</span>
            <IconArrowRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
