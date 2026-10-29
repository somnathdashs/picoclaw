import { IconCpu, IconKey, IconServer, IconSparkles } from "@tabler/icons-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { ModelInfo } from "@/api/models"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ModelSelectorProps {
  defaultModelName: string
  apiKeyModels: ModelInfo[]
  oauthModels: ModelInfo[]
  localModels: ModelInfo[]
  disabled?: boolean
  onValueChange: (modelName: string) => void
}

export function ModelSelector({
  defaultModelName,
  apiKeyModels,
  oauthModels,
  localModels,
  disabled = false,
  onValueChange,
}: ModelSelectorProps) {
  const { t } = useTranslation()

  // Fallback if current model is not present in fetched lists
  const rawDefaultModel = useMemo(() => {
    return defaultModelName &&
      ![...apiKeyModels, ...oauthModels, ...localModels].some(
        (model) => model.model_name === defaultModelName,
      )
      ? defaultModelName
      : ""
  }, [defaultModelName, apiKeyModels, oauthModels, localModels])

  return (
    <Select
      value={defaultModelName}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("chat.modelSelector", "Select AI Model")}
        className={cn(
          "xs:h-8 xs:px-2.5 border-border/50 bg-muted/40 hover:bg-muted/70 hover:border-border/80 h-7 cursor-pointer rounded-lg border px-2 shadow-none transition-colors",
          "xs:text-xs tv:text-base text-[11px] sm:text-sm",
          "xxs:max-w-[150px] xs:max-w-[210px] tv:max-w-[480px] max-w-[120px] min-w-[70px] sm:max-w-[280px] md:max-w-[360px]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          <IconSparkles className="text-primary size-3.5 shrink-0" />
          <SelectValue placeholder={t("chat.noModel", "Select a model")} />
        </div>
      </SelectTrigger>

      <SelectContent
        position="popper"
        align="start"
        className="xs:max-h-80 tv:max-h-96 max-h-72 max-w-[90vw] min-w-[200px] sm:max-w-[380px]"
      >
        {rawDefaultModel && (
          <SelectItem
            value={rawDefaultModel}
            className="py-1.5 font-mono text-xs sm:text-sm"
          >
            {rawDefaultModel}
          </SelectItem>
        )}

        {rawDefaultModel &&
          (apiKeyModels.length > 0 ||
            oauthModels.length > 0 ||
            localModels.length > 0) && <SelectSeparator />}

        {apiKeyModels.length > 0 && (
          <SelectGroup>
            <SelectLabel className="xs:text-[11px] text-muted-foreground flex items-center gap-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              <IconKey className="size-3" />
              <span>{t("chat.modelGroup.apikey", "API Key")}</span>
            </SelectLabel>
            {apiKeyModels.map((model) => (
              <SelectItem
                key={model.index}
                value={model.model_name}
                className="cursor-pointer py-1.5 text-xs sm:text-sm"
              >
                <span className="truncate font-mono">{model.model_name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {apiKeyModels.length > 0 &&
          (oauthModels.length > 0 || localModels.length > 0) && (
            <SelectSeparator />
          )}

        {oauthModels.length > 0 && (
          <SelectGroup>
            <SelectLabel className="xs:text-[11px] text-muted-foreground flex items-center gap-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              <IconCpu className="size-3 text-blue-500" />
              <span>{t("chat.modelGroup.oauth", "OAuth")}</span>
            </SelectLabel>
            {oauthModels.map((model) => (
              <SelectItem
                key={model.index}
                value={model.model_name}
                className="cursor-pointer py-1.5 text-xs sm:text-sm"
              >
                <span className="truncate font-mono">{model.model_name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {oauthModels.length > 0 && localModels.length > 0 && (
          <SelectSeparator />
        )}

        {localModels.length > 0 && (
          <SelectGroup>
            <SelectLabel className="xs:text-[11px] text-muted-foreground flex items-center gap-1.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              <IconServer className="size-3 text-emerald-500" />
              <span>{t("chat.modelGroup.local", "Local")}</span>
            </SelectLabel>
            {localModels.map((model) => (
              <SelectItem
                key={model.index}
                value={model.model_name}
                className="cursor-pointer py-1.5 text-xs sm:text-sm"
              >
                <span className="truncate font-mono">{model.model_name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
