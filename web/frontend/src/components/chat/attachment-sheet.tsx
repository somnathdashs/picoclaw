import {
  IconBrain,
  IconCamera,
  IconFileUpload,
  IconPhoto,
} from "@tabler/icons-react"
import { type ReactNode, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const THINKING_LEVEL_OPTIONS = [
  { value: "off", label: "Off", shortLabel: "Off" },
  { value: "low", label: "Low", shortLabel: "Low" },
  { value: "medium", label: "Medium", shortLabel: "Med" },
  { value: "high", label: "High", shortLabel: "High" },
  { value: "xhigh", label: "Max", shortLabel: "Max" },
  { value: "adaptive", label: "Adaptive", shortLabel: "Auto" },
] as const

interface AttachmentPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickImage: () => void
  onCaptureImage: () => void
  onUploadFile?: () => void
  thinkingLevel?: string
  onUpdateThinkingLevel?: (level: string) => Promise<void> | void
  children: ReactNode
}

function getBadgeColorClass(value: string): string {
  switch (value) {
    case "low":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    case "medium":
      return "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
    case "high":
      return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
    case "xhigh":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    case "adaptive":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    default:
      return "border-border bg-muted/60 text-muted-foreground"
  }
}

export function AttachmentPopup({
  open,
  onOpenChange,
  onPickImage,
  onCaptureImage,
  onUploadFile,
  thinkingLevel = "",
  onUpdateThinkingLevel,
  children,
}: AttachmentPopupProps) {
  const { t } = useTranslation()

  const normalizedLevel = thinkingLevel.trim().toLowerCase()
  const initialIndex = THINKING_LEVEL_OPTIONS.findIndex(
    (opt) => opt.value === normalizedLevel,
  )
  const activeIndex = initialIndex >= 0 ? initialIndex : 0

  const [sliderIndex, setSliderIndex] = useState(activeIndex)
  const [isUpdatingThinking, setIsUpdatingThinking] = useState(false)

  useEffect(() => {
    setSliderIndex(activeIndex)
  }, [activeIndex])

  const handleLevelChange = async (newIndex: number) => {
    setSliderIndex(newIndex)
    const opt = THINKING_LEVEL_OPTIONS[newIndex]
    if (opt && onUpdateThinkingLevel) {
      setIsUpdatingThinking(true)
      try {
        await onUpdateThinkingLevel(opt.value)
      } finally {
        setIsUpdatingThinking(false)
      }
    }
  }

  const handleCapture = () => {
    onOpenChange(false)
    onCaptureImage()
  }

  const handlePick = () => {
    onOpenChange(false)
    onPickImage()
  }

  const handleUploadFile = () => {
    onOpenChange(false)
    onUploadFile?.()
  }

  const currentOption = THINKING_LEVEL_OPTIONS[sliderIndex] ?? THINKING_LEVEL_OPTIONS[0]

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-50 w-76 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 bg-background/95 p-3 shadow-xl backdrop-blur-md duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2"
      >
        <div className="pb-1.5 text-left">
          <div className="text-xs font-semibold text-foreground">
            {t("chat.addAttachment", "Add attachment")}
          </div>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-2 pt-0.5">
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild onFocus={(e) => e.preventDefault()}>
                <button
                  type="button"
                  onClick={handleCapture}
                  aria-label={t("chat.captureImage", "Capture image")}
                  className="group flex flex-1 items-center justify-center h-10 rounded-xl border border-border/50 bg-muted/30 text-primary transition hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                >
                  <IconCamera className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="z-[100]">
                {t("chat.captureImage", "Capture image")}
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild onFocus={(e) => e.preventDefault()}>
                <button
                  type="button"
                  onClick={handlePick}
                  aria-label={t("chat.pickImage", "Pick image")}
                  className="group flex flex-1 items-center justify-center h-10 rounded-xl border border-border/50 bg-muted/30 text-primary transition hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                >
                  <IconPhoto className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="z-[100]">
                {t("chat.pickImage", "Pick image")}
              </TooltipContent>
            </Tooltip>

            {onUploadFile && (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild onFocus={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    onClick={handleUploadFile}
                    aria-label={t("chat.uploadFile", "Pick a file")}
                    className="group flex flex-1 items-center justify-center h-10 rounded-xl border border-border/50 bg-muted/30 text-primary transition hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                  >
                    <IconFileUpload className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="z-[100]">
                  {t("chat.uploadFile", "Pick a file")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        {onUpdateThinkingLevel && (
          <>
            <div className="my-2.5 border-t border-border/60" />

            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <IconBrain className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {t("models.field.thinkingLevel", "Thinking")}
                  </span>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold border capitalize transition-colors",
                    getBadgeColorClass(currentOption.value),
                  )}
                >
                  {currentOption.label}
                </span>
              </div>

              <div className="px-1 py-1 space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={THINKING_LEVEL_OPTIONS.length - 1}
                  step={1}
                  value={sliderIndex}
                  onChange={(e) => void handleLevelChange(Number(e.target.value))}
                  disabled={isUpdatingThinking}
                  className="w-full accent-violet-600 dark:accent-violet-400 cursor-pointer h-1.5 bg-muted rounded-lg appearance-none disabled:opacity-50"
                  aria-label={t("models.field.thinkingLevel", "Thinking Level")}
                />

                <div className="flex justify-between text-[9px] text-muted-foreground font-medium">
                  {THINKING_LEVEL_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => void handleLevelChange(idx)}
                      disabled={isUpdatingThinking}
                      className={cn(
                        "transition-colors cursor-pointer hover:text-foreground",
                        sliderIndex === idx &&
                          "text-violet-600 dark:text-violet-400 font-bold",
                      )}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { AttachmentPopup as AttachmentSheet }
