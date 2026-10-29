import { IconHistory } from "@tabler/icons-react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { SessionHistoryMenu } from "@/components/chat/session-history-menu"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePicoChat } from "@/hooks/use-pico-chat"
import { useSessionHistory } from "@/hooks/use-session-history"

export function HeaderChatHistory() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  })

  const { activeSessionId, switchSession, newChat } = usePicoChat()

  const {
    sessions,
    hasMore,
    loadError,
    loadErrorMessage,
    observerRef,
    loadSessions,
    handleDeleteSession,
  } = useSessionHistory({
    activeSessionId,
    onDeletedActiveSession: newChat,
  })

  const handleSwitchSession = (sessionId: string) => {
    switchSession(sessionId)
    if (currentPath !== "/" && currentPath !== "/chat") {
      void navigate({ to: "/" })
    }
  }

  return (
    <SessionHistoryMenu
      sessions={sessions}
      activeSessionId={activeSessionId}
      hasMore={hasMore}
      loadError={loadError}
      loadErrorMessage={loadErrorMessage}
      observerRef={observerRef}
      onOpenChange={(open) => {
        if (open) {
          void loadSessions(true)
        }
      }}
      onSwitchSession={handleSwitchSession}
      onDeleteSession={handleDeleteSession}
      trigger={
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              aria-label={t("chat.history")}
            >
              <IconHistory className="size-4.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("chat.history")}</TooltipContent>
        </Tooltip>
      }
    />
  )
}
