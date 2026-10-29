import {
  IconArrowUp,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhotoPlus,
  IconPlayerStopFilled,
  IconX,
} from "@tabler/icons-react"
import {
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
} from "react"
import { useTranslation } from "react-i18next"
import TextareaAutosize from "react-textarea-autosize"

import { ContextUsageRing } from "@/components/chat/context-usage-ring"
import { Button } from "@/components/ui/button"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { cn } from "@/lib/utils"
import type { ChatAttachment, ContextUsage } from "@/store/chat"

export type ChatInputDisabledReason =
  | "gatewayUnknown"
  | "gatewayStarting"
  | "gatewayRestarting"
  | "gatewayStopping"
  | "gatewayStopped"
  | "gatewayError"
  | "websocketConnecting"
  | "websocketDisconnected"
  | "websocketError"
  | "noDefaultModel"

interface ChatComposerProps {
  input: string
  attachments: ChatAttachment[]
  onInputChange: (value: string) => void
  onAddImages: () => void
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void
  onDragEnter: (event: ReactDragEvent<HTMLDivElement>) => void
  onDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void
  onRemoveAttachment: (index: number) => void
  onSend: () => void
  onContextDetail?: () => void
  inputDisabledReason: ChatInputDisabledReason | null
  canSend: boolean
  isWorking?: boolean
  onStop?: () => void
  isDragActive: boolean
  contextUsage?: ContextUsage
  footer?: React.ReactNode
}

export function ChatComposer({
  input,
  attachments,
  onInputChange,
  onAddImages,
  onPaste,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRemoveAttachment,
  onSend,
  onContextDetail,
  inputDisabledReason,
  canSend,
  isWorking = false,
  onStop,
  isDragActive,
  contextUsage,
  footer,
}: ChatComposerProps) {
  const { t } = useTranslation()
  const canInput = inputDisabledReason === null
  const composingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasInput = input.trim().length > 0 || attachments.length > 0

  useEffect(() => {
    if (canInput) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [canInput])
  const disabledMessage =
    inputDisabledReason === null
      ? null
      : t(`chat.disabledPlaceholder.${inputDisabledReason}`)
  const placeholder = disabledMessage ?? t("chat.placeholder")

  const { isListening, isSupported, toggleListening } = useSpeechRecognition({
    onTranscript: onInputChange,
    currentValue: input,
  })

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = e.nativeEvent as Event & {
      isComposing?: boolean
      keyCode?: number
    }
    if (
      composingRef.current ||
      nativeEvent.isComposing ||
      nativeEvent.keyCode === 229
    ) {
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="relative z-10 shrink-0 px-3 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-8 md:pb-4 lg:px-20 xl:px-36">
      <div className="mx-auto flex w-full max-w-[860px] flex-col items-end">
        <div
          className={cn(
            "bg-card border-border/60 relative flex w-full flex-col rounded-2xl border p-2 sm:p-2.5 shadow-xs transition-colors",
            isDragActive && "border-violet-400/70 bg-violet-500/5",
          )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-400/70 bg-violet-500/10">
              <div className="bg-background/95 text-foreground rounded-full px-4 py-2 text-sm font-medium shadow-sm">
                {t("chat.dropImagesActive")}
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-1">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.url}-${index}`}
                  className="bg-background relative h-16 w-16 overflow-hidden rounded-xl border"
                >
                  <img
                    src={attachment.url}
                    alt={attachment.filename || t("chat.uploadedImage")}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(index)}
                    className="bg-background/85 text-foreground absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-xs transition hover:bg-white"
                    aria-label={t("chat.removeImage")}
                    title={t("chat.removeImage")}
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex w-full items-end gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full mb-0.5"
              onClick={onAddImages}
              disabled={!canInput}
              aria-label={t("chat.attachImage")}
              title={t("chat.attachImage")}
            >
              <IconPhotoPlus className="size-4" />
            </Button>

            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onCompositionStart={() => {
                composingRef.current = true
              }}
              onCompositionEnd={() => {
                composingRef.current = false
              }}
              onPaste={onPaste}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={!canInput}
              title={disabledMessage || undefined}
              className={cn(
                "placeholder:text-muted-foreground/50 max-h-[160px] min-h-[32px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1 text-sm leading-relaxed shadow-none transition-colors focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent",
                !canInput && "cursor-not-allowed",
              )}
              minRows={1}
              maxRows={6}
            />

            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              {contextUsage && (
                <ContextUsageRing
                  usage={contextUsage}
                  onDetailClick={onContextDetail}
                />
              )}

              {/* Listening Status Badge */}
              {isListening && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-medium animate-pulse shadow-2xs">
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-1.5 bg-rose-500"></span>
                  </span>
                  <span className="hidden sm:inline">Listening...</span>
                </div>
              )}

              {/* Mic on Right Side */}
              <Button
                type="button"
                variant={isListening ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-7 w-7 sm:h-8 sm:w-8 rounded-full transition-all duration-300",
                  isListening
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 hover:bg-rose-600 ring-2 ring-rose-400/50"
                    : "text-muted-foreground hover:text-foreground",
                  !isSupported && "opacity-40",
                )}
                onClick={toggleListening}
                disabled={!canInput}
                aria-label={isListening ? "Stop listening" : "Transcribe speech"}
                title={
                  isListening
                    ? "Listening... Speak into microphone. Click to stop."
                    : isSupported
                      ? "Transcribe speech with browser microphone"
                      : "Speech recognition not supported in this browser"
                }
              >
                {isListening ? (
                  <IconMicrophone className="size-4 animate-pulse" />
                ) : isSupported ? (
                  <IconMicrophone className="size-4" />
                ) : (
                  <IconMicrophoneOff className="size-4" />
                )}
              </Button>

              {isWorking && !hasInput ? (
                <Button
                  type="button"
                  size="icon"
                  className="size-7 sm:size-8 rounded-full bg-rose-600 text-white hover:bg-rose-700 active:scale-95 transition-all shadow-xs ring-1 ring-rose-400/50"
                  onClick={onStop}
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <IconPlayerStopFilled className="size-3.5 sm:size-4" />
                </Button>
              ) : canInput ? (
                <span tabIndex={!canSend ? 0 : undefined}>
                  <Button
                    type="button"
                    size="icon"
                    className="size-7 sm:size-8 rounded-full bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-40"
                    onClick={onSend}
                    disabled={!canSend}
                    aria-label={t("chat.sendMessage")}
                    title={t("chat.sendMessage")}
                  >
                    <IconArrowUp className="size-4" />
                  </Button>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          aria-hidden={!hasInput}
          className={cn(
            "border-border/50 bg-muted/55 text-muted-foreground mt-1 inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] shadow-2xs transition-all duration-200 dark:bg-muted/45",
            hasInput
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0",
          )}
        >
          {t("chat.composeHint")}
        </div>

        {footer && <div className="mt-1.5 w-full">{footer}</div>}
      </div>
    </div>
  )
}
