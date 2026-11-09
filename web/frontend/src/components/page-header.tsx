import { IconMenu2, IconRefresh } from "@tabler/icons-react"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useGateway } from "@/hooks/use-gateway"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  beforeTitle?: ReactNode
  titleExtra?: ReactNode
  centerContent?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  beforeTitle,
  titleExtra,
  centerContent,
  children,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation()
  const {
    state: gwState,
    loading: gwLoading,
    canStart,
    restartRequired,
    restart,
  } = useGateway()

  const isRestarting = gwState === "restarting"

  useEffect(() => {
    if (title) {
      document.title = `${title} - PicoClaw`
    }
  }, [title])

  const handleGatewayRestart = () => {
    if (gwLoading || isRestarting || !restartRequired || !canStart) return
    void restart()
  }

  return (
    <div
      className={cn(
        "xs:px-4 z-40 flex h-14 shrink-0 items-center justify-between gap-1 px-2 pt-2 sm:gap-2 sm:px-6",
        className,
      )}
    >
      <div className="xs:gap-2 flex min-w-0 flex-1 items-center gap-1 sm:gap-4">
        <SidebarTrigger className="border-border/60 bg-background text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border [&>svg]:size-4 sm:[&>svg]:size-5">
          <IconMenu2 />
        </SidebarTrigger>
        {beforeTitle}
        {title && (
          <h2 className="text-foreground xs:text-base truncate text-xs sm:text-sm font-semibold tracking-tight md:text-xl">
            {title}
          </h2>
        )}
        {titleExtra}
      </div>

      {centerContent && (
        <div className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-4">
          {centerContent}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1 xs:gap-1.5 sm:gap-2">
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
                <IconRefresh
                  className={cn("size-3.5", isRestarting && "animate-spin")}
                />
                <span className="hidden sm:inline">
                  {t("header.gateway.action.restart")}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("header.gateway.restartRequired")}
            </TooltipContent>
          </Tooltip>
        )}
        {children}
      </div>
    </div>
  )
}
