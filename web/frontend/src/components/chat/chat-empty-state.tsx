import {
  IconPlugConnectedX,
  IconRobot,
  IconRobotOff,
  IconStar,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface ChatEmptyStateProps {
  hasAvailableModels: boolean
  defaultModelName: string
  isConnected: boolean
  compact?: boolean
  onSelectPrompt?: (prompt: string) => void
}

export function ChatEmptyState({
  hasAvailableModels,
  defaultModelName,
  isConnected,
  compact = false,
  onSelectPrompt,
}: ChatEmptyStateProps) {
  const { t } = useTranslation()

  if (!hasAvailableModels) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-70">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <IconRobotOff className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-medium">
          {t("chat.empty.noConfiguredModel")}
        </h3>
        <p className="text-muted-foreground mb-4 text-center text-sm">
          {t("chat.empty.noConfiguredModelDescription")}
        </p>
        <Button asChild variant="outline" size="sm" className="px-4">
          <Link to="/models">{t("chat.empty.goToModels")}</Link>
        </Button>
      </div>
    )
  }

  if (!defaultModelName) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-70">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <IconStar className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-medium">
          {t("chat.empty.noSelectedModel")}
        </h3>
        <p className="text-muted-foreground mb-4 text-center text-sm">
          {t("chat.empty.noSelectedModelDescription")}
        </p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-70">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <IconPlugConnectedX className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-medium">
          {t("chat.empty.notRunning")}
        </h3>
        <p className="text-muted-foreground mb-4 text-center text-sm">
          {t("chat.empty.notRunningDescription")}
        </p>
      </div>
    )
  }

  const starterSuggestions = [
    {
      title: "Automations & Tasks",
      prompt: "Show me my active automations and scheduled tasks",
      desc: "Check crons, alerts, and recurring background jobs",
    },
    {
      title: "Channels & Connections",
      prompt: "Check status of connected communication channels",
      desc: "Review WhatsApp, Telegram, Discord, and others",
    },
    {
      title: "Model & Capabilities",
      prompt: "What tools and models are currently available?",
      desc: "Discover active tools, bash execution, and search",
    },
    {
      title: "Quick Health Check",
      prompt: "Run a system health check and summarize activity",
      desc: "Overview of services, memory usage, and runtime",
    },
  ]

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        compact ? "py-6 sm:py-8" : "py-12 sm:py-16"
      }`}
    >
      <div
        className={`bg-primary/10 text-primary mb-4 flex items-center justify-center rounded-2xl shadow-xs ${
          compact ? "h-12 w-12" : "h-16 w-16"
        }`}
      >
        <IconRobot className={compact ? "h-6 w-6" : "h-8 w-8"} />
      </div>
      <h3 className="text-foreground mb-1 text-lg font-semibold sm:text-xl">
        {t("chat.welcome")}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm text-center text-xs sm:text-sm">
        {t("chat.welcomeDesc")}
      </p>

      {onSelectPrompt && (
        <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 px-2 sm:grid-cols-2">
          {starterSuggestions.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="border-border/50 bg-card/60 hover:bg-muted/70 hover:border-primary/40 group focus-visible:ring-primary flex cursor-pointer flex-col rounded-xl border p-3 text-left text-xs transition-all focus-visible:ring-1 focus-visible:outline-none"
            >
              <span className="text-foreground group-hover:text-primary font-medium transition-colors">
                {item.title}
              </span>
              <span className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
