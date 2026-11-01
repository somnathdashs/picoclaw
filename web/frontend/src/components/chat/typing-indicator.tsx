import { IconRobot, IconSparkles } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

export function TypingIndicator() {
  const { t } = useTranslation()
  const thinkingSteps = [
    t("chat.thinking.step1"),
    t("chat.thinking.step2"),
    t("chat.thinking.step3"),
    t("chat.thinking.step4"),
  ]
  const [stepIndex, setStepIndex] = useState(0)
  const [dotsCount, setDotsCount] = useState(1)

  useEffect(() => {
    const stepsCount = thinkingSteps.length
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % stepsCount)
    }, 2800)
    const dotsInterval = setInterval(() => {
      setDotsCount((prev) => (prev >= 4 ? 1 : prev + 1))
    }, 450)
    return () => {
      clearInterval(stepInterval)
      clearInterval(dotsInterval)
    }
  }, [thinkingSteps.length])

  return (
    <div className="flex w-full flex-col gap-2 py-1 select-none animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
        <div className="relative flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconRobot className="size-3.5" />
          <span className="absolute -inset-0.5 animate-ping rounded-lg bg-primary/20 opacity-30" />
        </div>
        <span className="font-semibold text-foreground/90">PicoClaw</span>
        <span className="opacity-40">•</span>
        <span className="font-mono text-[11px] text-muted-foreground/70">
          Thinking{".".repeat(dotsCount)}
        </span>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-3 sm:p-4 shadow-xs backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <IconSparkles className="size-4 shrink-0 text-primary animate-pulse" />
              <p
                key={stepIndex}
                className="animate-[fadeSlideIn_0.3s_ease-out] truncate text-xs font-medium text-foreground/85"
              >
                {thinkingSteps[stepIndex]}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="size-1.5 animate-bounce rounded-full bg-primary/80 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary/80 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary/80" />
            </div>
          </div>

          <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
          </div>
        </div>
      </div>
    </div>
  )
}
