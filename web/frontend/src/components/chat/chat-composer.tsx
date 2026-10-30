import {
  IconArrowUp,
  IconMicrophone,
  IconMicrophoneOff,
  IconPlayerStopFilled,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import {
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import TextareaAutosize from "react-textarea-autosize"

import { getSkills } from "@/api/skills"
import { AttachmentPopup } from "@/components/chat/attachment-sheet"
import { CameraCaptureDialog } from "@/components/chat/camera-capture-dialog"
import { CommandSuggestions } from "@/components/chat/command-suggestions"
import { ContextUsageRing } from "@/components/chat/context-usage-ring"
import { SkillSuggestions } from "@/components/chat/skill-suggestions"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_SKILLS,
  filterSkills,
  type SkillSuggestion,
} from "@/features/chat/skill-suggestions"
import {
  filterSlashCommands,
  type SlashCommand,
} from "@/features/chat/slash-commands"
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
  onCaptureImage?: (file: File) => void
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
  thinkingLevel?: string
  onUpdateThinkingLevel?: (level: string) => Promise<void> | void
  footer?: React.ReactNode
}

// Render highlighted tokens for slash commands (violet) and skills (amber)
function renderHighlightedContent(text: string) {
  if (!text) return null
  const regex = /(^|\s)([\/#][a-zA-Z0-9_-]*)/g
  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const precedingIndex = match.index + match[1].length
    if (precedingIndex > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, precedingIndex)}
        </span>,
      )
    }

    const token = match[2]
    const isCommand = token.startsWith("/")
    elements.push(
      <span
        key={`token-${match.index}`}
        className={cn(
          "font-semibold rounded-[4px] px-1 -mx-1 py-0.5 box-decoration-clone shadow-2xs transition-colors",
          isCommand
            ? "bg-violet-500/15 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300 ring-1 ring-violet-500/35 dark:ring-violet-400/35"
            : "bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300 ring-1 ring-amber-500/35 dark:ring-amber-400/35",
        )}
      >
        {token}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    elements.push(<span key="text-end">{text.slice(lastIndex)}</span>)
  }

  return (
    <>
      {elements}
      {text.endsWith("\n") && "\u200B"}
    </>
  )
}

export function ChatComposer({
  input,
  attachments,
  onInputChange,
  onAddImages,
  onCaptureImage,
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
  thinkingLevel,
  onUpdateThinkingLevel,
  footer,
}: ChatComposerProps) {
  const { t } = useTranslation()
  const canInput = inputDisabledReason === null
  const composingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const hasInput = input.trim().length > 0 || attachments.length > 0

  useEffect(() => {
    if (canInput) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [canInput])

  const { data: skillsData } = useQuery({
    queryKey: ["skills"],
    queryFn: getSkills,
    staleTime: 60000,
  })

  const allSkills = useMemo(() => {
    if (!skillsData?.skills || skillsData.skills.length === 0) {
      return DEFAULT_SKILLS
    }
    const map = new Map<string, SkillSuggestion>()
    for (const d of DEFAULT_SKILLS) {
      map.set(d.name, d)
    }
    for (const s of skillsData.skills) {
      map.set(s.name, {
        name: s.name,
        trigger: `#${s.name}`,
        description: s.description || map.get(s.name)?.description || "",
      })
    }
    return Array.from(map.values())
  }, [skillsData])

  const triggerInfo = useMemo(() => {
    if (isDismissed) return null
    const textBefore = input.slice(0, cursorPos)
    const match = textBefore.match(/(?:^|\s)([\/#][a-zA-Z0-9_-]*)$/)
    if (!match) return null

    const triggerWord = match[1]
    const triggerType = triggerWord[0] as "/" | "#"
    const startIndex = cursorPos - triggerWord.length
    let endIndex = cursorPos
    while (endIndex < input.length && !/\s/.test(input[endIndex])) {
      endIndex++
    }

    const query = triggerWord.slice(1)
    if (triggerType === "/") {
      const filtered = filterSlashCommands(query)
      return {
        type: "/" as const,
        query,
        startIndex,
        endIndex,
        commands: filtered,
      }
    } else {
      const filtered = filterSkills(allSkills, query)
      return {
        type: "#" as const,
        query,
        startIndex,
        endIndex,
        skills: filtered,
      }
    }
  }, [input, cursorPos, isDismissed, allSkills])

  const activeCount =
    triggerInfo?.type === "/"
      ? triggerInfo.commands.length
      : triggerInfo?.type === "#"
        ? triggerInfo.skills.length
        : 0

  useEffect(() => {
    setSelectedIndex(0)
  }, [activeCount, triggerInfo?.query, triggerInfo?.type])

  useEffect(() => {
    if (!triggerInfo) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setIsDismissed(true)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [triggerInfo])

  const disabledMessage =
    inputDisabledReason === null
      ? null
      : t(`chat.disabledPlaceholder.${inputDisabledReason}`)
  const placeholder = disabledMessage ?? t("chat.placeholder")

  const { isListening, isSupported, toggleListening } = useSpeechRecognition({
    onTranscript: onInputChange,
    currentValue: input,
  })

  const handleSelectCommand = (cmd: SlashCommand) => {
    if (!triggerInfo || triggerInfo.type !== "/") return
    const before = input.slice(0, triggerInfo.startIndex)
    const after = input.slice(triggerInfo.endIndex)
    const replacement = `${cmd.command} `
    const nextValue = `${before}${replacement}${after.replace(/^\s*/, "")}`
    onInputChange(nextValue)
    const nextCursor = before.length + replacement.length
    setCursorPos(nextCursor)
    setIsDismissed(true)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(nextCursor, nextCursor)
      }
    }, 10)
  }

  const handleSelectSkill = (skill: SkillSuggestion) => {
    if (!triggerInfo || triggerInfo.type !== "#") return
    const before = input.slice(0, triggerInfo.startIndex)
    const after = input.slice(triggerInfo.endIndex)
    const replacement = `#${skill.name} `
    const nextValue = `${before}${replacement}${after.replace(/^\s*/, "")}`
    onInputChange(nextValue)
    const nextCursor = before.length + replacement.length
    setCursorPos(nextCursor)
    setIsDismissed(true)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(nextCursor, nextCursor)
      }
    }, 10)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onInputChange(val)
    setCursorPos(e.target.selectionStart ?? val.length)
    setIsDismissed(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  const handleCursorUpdate = (
    e: React.SyntheticEvent<HTMLTextAreaElement>,
  ) => {
    const target = e.target as HTMLTextAreaElement
    setCursorPos(target.selectionStart ?? 0)
  }

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

    if (triggerInfo && activeCount > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % activeCount)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + activeCount) % activeCount)
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        if (triggerInfo.type === "/") {
          handleSelectCommand(triggerInfo.commands[selectedIndex])
        } else {
          handleSelectSkill(triggerInfo.skills[selectedIndex])
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setIsDismissed(true)
        return
      }
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
          {triggerInfo?.type === "/" && triggerInfo.commands.length > 0 && (
            <CommandSuggestions
              commands={triggerInfo.commands}
              selectedIndex={selectedIndex}
              onSelect={handleSelectCommand}
            />
          )}

          {triggerInfo?.type === "#" && triggerInfo.skills.length > 0 && (
            <SkillSuggestions
              skills={triggerInfo.skills}
              selectedIndex={selectedIndex}
              onSelect={handleSelectSkill}
            />
          )}

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
            <AttachmentPopup
              open={isAttachmentOpen}
              onOpenChange={setIsAttachmentOpen}
              onPickImage={onAddImages}
              onCaptureImage={() => setIsCameraOpen(true)}
              thinkingLevel={thinkingLevel}
              onUpdateThinkingLevel={onUpdateThinkingLevel}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "text-muted-foreground hover:text-foreground h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full mb-0.5 transition-all duration-200 active:scale-95",
                  isAttachmentOpen && "bg-muted text-foreground rotate-45",
                )}
                disabled={!canInput}
                aria-label={t("chat.addAttachment", "Add attachment")}
                title={t("chat.addAttachment", "Add attachment")}
              >
                <IconPlus className="size-4" />
              </Button>
            </AttachmentPopup>

            <div className="relative flex-1 min-w-0">
              <div
                ref={backdropRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 max-h-[160px] min-h-[32px] overflow-hidden px-1.5 py-1 font-sans text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground select-none"
              >
                {renderHighlightedContent(input)}
              </div>

              <TextareaAutosize
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onScroll={handleScroll}
                onSelect={handleCursorUpdate}
                onKeyUp={handleCursorUpdate}
                onClick={handleCursorUpdate}
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
                  "relative z-10 max-h-[160px] min-h-[32px] w-full resize-none border-0 bg-transparent px-1.5 py-1 font-sans text-sm leading-relaxed shadow-none transition-colors focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent",
                  input
                    ? "text-transparent caret-foreground selection:bg-primary/25 selection:text-transparent"
                    : "text-foreground",
                  !canInput && "cursor-not-allowed",
                )}
                minRows={1}
                maxRows={6}
              />
            </div>

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

      <CameraCaptureDialog
        open={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={(file) => onCaptureImage?.(file)}
      />
    </div>
  )
}
