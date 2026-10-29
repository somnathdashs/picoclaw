import {
  IconAlertCircle,
  IconBook,
  IconInfoCircle,
  IconLanguage,
  IconLoader2,
  IconLogout,
  IconPlayerPlay,
  IconPower,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { postLauncherDashboardLogout } from "@/api/launcher-auth"
import { ThemeSelector } from "@/components/theme-selector"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useGateway } from "@/hooks/use-gateway"
import { cn } from "@/lib/utils"

export function SidebarNavFooter() {
  const { i18n, t } = useTranslation()
  const {
    state: gwState,
    loading: gwLoading,
    canStart,
    startReason,
    restartRequired,
    start,
    restart,
    stop,
    error: gwError,
    clearError,
  } = useGateway()

  const isRunning = gwState === "running"
  const isStarting = gwState === "starting"
  const isRestarting = gwState === "restarting"
  const isStopping = gwState === "stopping"
  const isStopped = gwState === "stopped" || gwState === "unknown"

  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const handleLogout = async () => {
    await postLauncherDashboardLogout()
    globalThis.location.assign("/launcher-login")
  }

  const handleGatewayToggle = () => {
    if (
      gwLoading ||
      isRestarting ||
      isStopping ||
      (!isRunning && !canStart && !gwError)
    ) {
      return
    }
    if (gwError) {
      clearError()
    }
    if (isRunning) {
      setShowStopDialog(true)
    } else {
      void start()
    }
  }

  const handleGatewayRestart = () => {
    if (gwLoading || isRestarting || !restartRequired || !canStart) return
    void restart()
  }

  const confirmStop = () => {
    setShowStopDialog(false)
    stop()
  }

  const statusLabel = isStopping
    ? t("header.gateway.status.stopping")
    : isRestarting
      ? t("header.gateway.status.restarting")
      : isStarting
        ? t("header.gateway.status.starting")
        : isRunning
          ? t("header.gateway.status.running")
          : t("header.gateway.status.stopped")

  return (
    <>
      <SidebarFooter className="border-border/50 mt-auto border-t p-2 group-data-[collapsible=icon]:p-1.5">
        {/* EXPANDED VIEW: When sidebar is wide / expanded */}
        <div className="space-y-2 group-data-[collapsible=icon]:hidden">
          {/* Gateway Control Card */}
          <div
            className={cn(
              "rounded-xl border p-2 text-xs shadow-2xs transition-colors",
              gwError
                ? "bg-destructive/5 border-destructive/40 dark:bg-destructive/10"
                : "bg-card/70 border-border/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    gwError &&
                      !isRunning &&
                      "animate-pulse bg-rose-500 shadow-xs shadow-rose-500/50",
                    !gwError &&
                      isRunning &&
                      "animate-pulse bg-emerald-500 shadow-xs shadow-emerald-500/50",
                    !gwError && isStopped && "bg-amber-500",
                    (isStarting || isRestarting || isStopping) &&
                      "animate-ping bg-blue-500",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-foreground truncate text-[11px] font-semibold">
                    Gateway
                  </p>
                  <p className="text-muted-foreground truncate text-[10px]">
                    {gwError ? (
                      <span className="text-destructive flex items-center gap-1 font-medium">
                        <IconAlertCircle className="inline size-2.5 shrink-0" />
                        Error
                      </span>
                    ) : (
                      statusLabel
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {restartRequired && (
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-7 bg-amber-500/15 p-1 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
                        onClick={handleGatewayRestart}
                        disabled={
                          gwLoading || isRestarting || isStopping || !canStart
                        }
                        aria-label={t("header.gateway.action.restart")}
                      >
                        <IconRefresh
                          className={cn(
                            "size-3.5",
                            isRestarting && "animate-spin",
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("header.gateway.restartRequired")}
                    </TooltipContent>
                  </Tooltip>
                )}

                {isRunning ? (
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="size-7 p-1"
                        data-tour="gateway-button"
                        onClick={handleGatewayToggle}
                        disabled={gwLoading}
                        aria-label={t("header.gateway.action.stop")}
                      >
                        <IconPower className="size-3.5 opacity-90" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {gwError ?? t("header.gateway.action.stop")}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip
                    delayDuration={
                      gwError || (!canStart && startReason) ? 0 : 500
                    }
                  >
                    <TooltipTrigger asChild>
                      <span
                        className={
                          !canStart && !gwError && startReason
                            ? "cursor-not-allowed"
                            : undefined
                        }
                        tabIndex={
                          !canStart && !gwError && startReason ? 0 : undefined
                        }
                      >
                        <Button
                          variant={gwError ? "destructive" : "default"}
                          size="sm"
                          data-tour="gateway-button"
                          className={cn(
                            "h-7 gap-1 px-2.5 text-[11px] font-medium text-white",
                            gwError
                              ? "bg-rose-600 shadow-xs hover:bg-rose-700"
                              : "bg-emerald-600 hover:bg-emerald-700",
                            !canStart &&
                              !gwError &&
                              "pointer-events-none opacity-50",
                          )}
                          onClick={handleGatewayToggle}
                          disabled={
                            gwLoading ||
                            isStarting ||
                            isRestarting ||
                            isStopping ||
                            (!canStart && !gwError)
                          }
                        >
                          {gwLoading ||
                          isStarting ||
                          isRestarting ||
                          isStopping ? (
                            <IconLoader2 className="size-3 animate-spin" />
                          ) : gwError ? (
                            <IconRefresh className="size-3" />
                          ) : (
                            <IconPlayerPlay className="size-3" />
                          )}
                          <span>{gwError ? "Retry" : "Start"}</span>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {gwError || (!canStart && startReason) ? (
                      <TooltipContent>{gwError ?? startReason}</TooltipContent>
                    ) : null}
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Error detail row */}
            {gwError && (
              <div className="border-destructive/20 text-destructive animate-in fade-in mt-1.5 flex items-start justify-between gap-1 border-t pt-1.5 text-[10px] leading-tight duration-200">
                <div className="flex min-w-0 flex-1 items-start gap-1">
                  <IconAlertCircle className="text-destructive mt-0.5 size-3 shrink-0" />
                  <span
                    className="line-clamp-2 break-words select-text"
                    title={gwError}
                  >
                    {gwError}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive/70 hover:text-destructive hover:bg-destructive/15 size-4.5 shrink-0 rounded p-0"
                  onClick={clearError}
                  title="Dismiss error"
                >
                  <IconX className="size-2.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Organized Utility Options: Theme, Language, Docs, Logout */}
          <div className="bg-muted/40 border-border/40 flex items-center justify-between rounded-xl border px-2 py-1">
            <ThemeSelector side="top" align="end" />

            <DropdownMenu>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground size-7 p-1"
                    >
                      <IconLanguage className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("header.language.tooltip") || "Language"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("pt-BR")}>
                  Português (Brasil)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("bn-IN")}>
                  বাংলা
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("zh")}>
                  简体中文
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("cs")}>
                  Čeština
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground size-7 p-1"
                  data-tour="docs-button"
                  asChild
                >
                  <a
                    href="https://docs.picoclaw.io"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-7 p-1"
                  onClick={() => setShowLogoutDialog(true)}
                  aria-label={t("header.logout.tooltip")}
                >
                  <IconLogout className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("header.logout.tooltip")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* COLLAPSED ICON VIEW: When sidebar is collapsed to icon width */}
        <div className="hidden w-full py-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1.5">
          {/* Gateway Start/Stop Button with Status Dot */}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant={
                  isRunning ? "outline" : gwError ? "destructive" : "default"
                }
                size="icon"
                className={cn(
                  "relative size-8.5 rounded-lg p-1.5 transition-all",
                  isRunning
                    ? "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : gwError
                      ? "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25 ring-destructive/40 ring-1"
                      : "bg-emerald-600 text-white hover:bg-emerald-700",
                  !canStart &&
                    !isRunning &&
                    !gwError &&
                    "pointer-events-none opacity-50",
                )}
                onClick={handleGatewayToggle}
                disabled={gwLoading || isStarting || isRestarting || isStopping}
                aria-label={
                  gwError
                    ? `Gateway Error: ${gwError}`
                    : `Gateway: ${statusLabel}`
                }
              >
                {gwLoading || isStarting || isRestarting || isStopping ? (
                  <IconLoader2 className="text-primary size-4 animate-spin" />
                ) : isRunning ? (
                  <IconPower className="size-4" />
                ) : gwError ? (
                  <IconAlertCircle className="text-destructive size-4" />
                ) : (
                  <IconPlayerPlay className="size-4" />
                )}
                <span
                  className={cn(
                    "ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2",
                    gwError &&
                      !isRunning &&
                      "animate-pulse bg-rose-500 shadow-rose-500/50",
                    !gwError && isRunning && "animate-pulse bg-emerald-500",
                    !gwError && isStopped && "bg-amber-500",
                    (isStarting || isRestarting || isStopping) &&
                      "animate-ping bg-blue-500",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {gwError ? (
                <div className="max-w-xs space-y-1 p-0.5">
                  <div className="flex items-center gap-1 text-xs font-semibold text-rose-500">
                    <IconAlertCircle className="size-3.5 shrink-0" />
                    <span>Gateway Error</span>
                  </div>
                  <p className="text-muted-foreground text-[11px] break-words">
                    {gwError}
                  </p>
                  <p className="text-primary/90 text-[10px] font-medium">
                    Click button to retry
                  </p>
                </div>
              ) : (
                `Gateway: ${statusLabel} ${isRunning ? "(Click to Stop)" : "(Click to Start)"}`
              )}
            </TooltipContent>
          </Tooltip>

          {/* Restart Button: only shown when changes require a restart */}
          {restartRequired && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-8.5 rounded-lg bg-amber-500/20 p-1.5 text-amber-700 ring-1 ring-amber-400/50 transition-all hover:bg-amber-500/30 dark:text-amber-300"
                  onClick={handleGatewayRestart}
                  disabled={
                    gwLoading || isRestarting || isStopping || !canStart
                  }
                  aria-label={t("header.gateway.action.restart")}
                >
                  <IconRefresh
                    className={cn("size-4", isRestarting && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t("header.gateway.restartRequired")}
              </TooltipContent>
            </Tooltip>
          )}

          <SidebarSeparator className="bg-border/60 mx-auto my-0.5 w-5" />

          {/* Info ("i") Button opening Dropright Side Popup with original utility box */}
          <Popover>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted size-8.5 rounded-lg p-1.5"
                    aria-label="Utilities & Actions"
                  >
                    <IconInfoCircle className="size-4.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Actions & Utilities</TooltipContent>
            </Tooltip>

            <PopoverContent
              side="right"
              align="end"
              sideOffset={12}
              className="border-border/60 bg-popover/95 w-56 space-y-2 rounded-2xl p-2 shadow-xl backdrop-blur-xl"
            >
              <div className="border-border/40 flex items-center justify-between border-b px-1 pb-1.5">
                <span className="text-foreground text-xs font-semibold">
                  Actions & Utilities
                </span>
                <span className="text-muted-foreground text-[10px]">
                  PicoClaw
                </span>
              </div>

              {/* Gateway error notice inside popover if error exists */}
              {gwError && (
                <div className="bg-destructive/10 border-destructive/30 text-destructive space-y-1.5 rounded-xl border p-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-semibold">
                      <IconAlertCircle className="size-3.5" /> Gateway Error
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive/70 hover:text-destructive size-4 p-0"
                      onClick={clearError}
                    >
                      <IconX className="size-2.5" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-[10px] leading-tight break-words">
                    {gwError}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-6 w-full gap-1 bg-rose-600 text-[10px] font-medium hover:bg-rose-700"
                    onClick={handleGatewayToggle}
                  >
                    <IconRefresh className="size-3" />
                    Retry Gateway
                  </Button>
                </div>
              )}

              {/* Original Popup Box content: Theme, Language, Docs, Logout */}
              <div className="bg-muted/40 border-border/40 flex items-center justify-between rounded-xl border px-2 py-1">
                <ThemeSelector side="top" align="start" />

                <DropdownMenu>
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground size-7 p-1"
                        >
                          <IconLanguage className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {t("header.language.tooltip") || "Language"}
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="center" side="top">
                    <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>
                      English
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => i18n.changeLanguage("pt-BR")}
                    >
                      Português (Brasil)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => i18n.changeLanguage("bn-IN")}
                    >
                      বাংলা
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => i18n.changeLanguage("zh")}>
                      简体中文
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => i18n.changeLanguage("cs")}>
                      Čeština
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground size-7 p-1"
                      data-tour="docs-button"
                      asChild
                    >
                      <a
                        href="https://docs.picoclaw.io"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <IconBook className="size-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Documentation</TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-7 p-1"
                      onClick={() => setShowLogoutDialog(true)}
                      aria-label={t("header.logout.tooltip")}
                    >
                      <IconLogout className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {t("header.logout.tooltip")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </SidebarFooter>

      {/* Confirmation Dialogs */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("header.gateway.stopDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("header.gateway.stopDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("header.gateway.stopDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("header.logout.tooltip")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("header.logout.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleLogout()}>
              {t("header.logout.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
