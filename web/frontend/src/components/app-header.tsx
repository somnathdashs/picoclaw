import { IconMenu2, IconRefresh } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useGateway } from "@/hooks/use-gateway"

export function AppHeader() {
  const { t } = useTranslation()
  const {
    state: gwState,
    loading: gwLoading,
    canStart,
    restartRequired,
    restart,
  } = useGateway()

  const isRestarting = gwState === "restarting"
  const isStopping = gwState === "stopping"
  const showNotConnectedHint =
    !isRestarting &&
    !isStopping &&
    canStart &&
    (gwState === "stopped" || gwState === "error")

  const handleGatewayRestart = () => {
    if (gwLoading || isRestarting || !restartRequired || !canStart) return
    void restart()
  }

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 border-b-border/50 sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg sm:hidden [&>svg]:size-5">
          <IconMenu2 />
        </SidebarTrigger>
        <div className="hidden w-36 shrink-0 items-center sm:flex">
          <Link to="/">
            <img className="w-full" src="/logo_with_text.png" alt="Logo" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showNotConnectedHint && (
          <div className="text-muted-foreground flex items-center gap-2 rounded-full border border-dashed px-3 py-1 text-xs shadow-2xs backdrop-blur-md">
            <span className="bg-destructive/50 relative flex size-2 shrink-0 items-center justify-center rounded-full">
              <span className="bg-destructive absolute inline-flex size-full animate-ping rounded-full opacity-75"></span>
            </span>
            <span>{t("chat.notConnected")}</span>
          </div>
        )}

        {restartRequired && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 bg-amber-500/15 text-xs font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
                onClick={handleGatewayRestart}
                disabled={gwLoading || isRestarting || !canStart}
              >
                <IconRefresh className="size-3.5" />
                <span>{t("header.gateway.action.restart")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("header.gateway.restartRequired")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
