import {
  IconChevronDown,
  IconDotsVertical,
  IconGhost,
  IconPlus,
  IconScale,
} from "@tabler/icons-react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useAtom } from "jotai"
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  AssistantMessage,
  WorkedSectionGroup,
} from "@/components/chat/assistant-message"
import {
  ChatComposer,
  type ChatInputDisabledReason,
} from "@/components/chat/chat-composer"
import { ChatEmptyState } from "@/components/chat/chat-empty-state"
import { ModelSelector } from "@/components/chat/model-selector"
import { RulesPanel } from "@/components/chat/rules-panel"
import { TypingIndicator } from "@/components/chat/typing-indicator"
import { UserMessage } from "@/components/chat/user-message"
import { PageHeader } from "@/components/page-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

dayjs.extend(relativeTime)
import {
  CHAT_IMAGE_ACCEPT,
  buildChatImageAttachments,
  getTransferredFiles,
  hasFileTransfer,
} from "@/features/chat/image-input"
import { uploadToWorkspace } from "@/api/workspace"
import { useChatModels } from "@/hooks/use-chat-models"
import { useGateway } from "@/hooks/use-gateway"
import { formatMessageTime, usePicoChat } from "@/hooks/use-pico-chat"
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis"
import type {
  ChatAttachment,
  ChatMessage,
  ChatToolCall,
  ConnectionState,
} from "@/store/chat"
import {
  temporaryChatAtom,
  temporaryChatSaveMemoryAndFilesAtom,
  temporaryChatUseMemoryAtom,
} from "@/store/chat"
import { lastInputWasVoiceAtom } from "@/store/voice-agent"
import type { GatewayState } from "@/store/gateway"

function resolveChatInputDisabledReason({
  hasDefaultModel,
  connectionState,
  gatewayState,
}: {
  hasDefaultModel: boolean
  connectionState: ConnectionState
  gatewayState: GatewayState
}): ChatInputDisabledReason | null {
  if (gatewayState === "unknown") {
    return "gatewayUnknown"
  }

  if (gatewayState === "starting") {
    return "gatewayStarting"
  }

  if (gatewayState === "restarting") {
    return "gatewayRestarting"
  }

  if (gatewayState === "stopping") {
    return "gatewayStopping"
  }

  if (gatewayState === "stopped") {
    return "gatewayStopped"
  }

  if (gatewayState === "error") {
    return "gatewayError"
  }

  if (connectionState === "error") {
    return "websocketError"
  }

  if (!hasDefaultModel) {
    return "noDefaultModel"
  }

  return null
}

interface GroupedWorkItem {
  type: "work"
  id: string
  toolCalls: ChatToolCall[]
  thoughtContent?: string
  timestamp?: string | number
  isStreaming: boolean
  durationMs?: number
  modelName?: string
}

interface GroupedMessageItem {
  type: "message"
  id: string
  message: ChatMessage
  isStreaming: boolean
  turnUserMessage?: ChatMessage
}

type GroupedChatItem = GroupedWorkItem | GroupedMessageItem

// Group consecutive work items (thoughts + tools) into a single unified widget
function groupChatMessages(
  messages: ChatMessage[],
  isTyping: boolean,
): GroupedChatItem[] {
  const result: GroupedChatItem[] = []
  let currentWork: {
    id: string
    toolCalls: ChatToolCall[]
    thoughts: string[]
    timestamp?: string | number
    isStreaming: boolean
    startTimestamp?: number
    endTimestamp?: number
    modelName?: string
  } | null = null

  const flushWork = () => {
    if (!currentWork) return
    const hasTools = currentWork.toolCalls.length > 0
    const hasThoughts = currentWork.thoughts.length > 0

    if (!hasTools && !hasThoughts) {
      currentWork = null
      return
    }

    const allowedTools = currentWork.toolCalls
    const allowedThoughts = currentWork.thoughts

    if (allowedTools.length > 0 || allowedThoughts.length > 0) {
      let durationMs: number | undefined
      if (currentWork.startTimestamp && currentWork.endTimestamp) {
        const diff = currentWork.endTimestamp - currentWork.startTimestamp
        if (diff > 0 && diff < 300000) {
          durationMs = diff
        }
      }

      result.push({
        type: "work",
        id: currentWork.id,
        toolCalls: allowedTools,
        thoughtContent:
          allowedThoughts.length > 0
            ? allowedThoughts.join("\n\n---\n\n")
            : undefined,
        timestamp: currentWork.timestamp,
        isStreaming: currentWork.isStreaming,
        durationMs,
        modelName: currentWork.modelName,
      })
    }
    currentWork = null
  }

  // Find index of last user message reliably without ES2023 findLastIndex
  let lastUserIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i
      break
    }
  }

  // Check if the current turn has a completed normal assistant text message
  let currentTurnHasFinishedNormal = false
  if (lastUserIndex !== -1) {
    for (let i = lastUserIndex + 1; i < messages.length; i++) {
      const m = messages[i]
      if (
        m.role === "assistant" &&
        m.kind !== "thought" &&
        m.kind !== "tool_calls" &&
        Boolean(m.content && m.content.trim())
      ) {
        currentTurnHasFinishedNormal = true
        break
      }
    }
  }

  // Current turn is active only while typing is ongoing
  const isLatestTurnActive = Boolean(isTyping && lastUserIndex !== -1)

  let currentTurnUserMessage: ChatMessage | null = null

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const isCurrentTurn = lastUserIndex !== -1 && i > lastUserIndex
    const isLastMessage = i === messages.length - 1
    const isTurnStreaming = isCurrentTurn ? isLatestTurnActive : false

    if (msg.role === "user") {
      currentTurnUserMessage = msg
      flushWork()
      result.push({
        type: "message",
        id: msg.id,
        message: msg,
        isStreaming: false,
        turnUserMessage: msg,
      })
      continue
    }

    const isThought = msg.kind === "thought"
    const isToolCallMsg =
      msg.kind === "tool_calls" ||
      (Boolean(msg.toolCalls && msg.toolCalls.length > 0) &&
        !msg.content.trim())

    if (isThought || isToolCallMsg) {
      if (!currentWork) {
        const tsNum =
          typeof msg.timestamp === "number"
            ? msg.timestamp
            : Date.parse(String(msg.timestamp)) || undefined
        currentWork = {
          id: `work-${msg.id}`,
          toolCalls: [],
          thoughts: [],
          timestamp: msg.timestamp,
          isStreaming: isTurnStreaming,
          startTimestamp: tsNum,
          modelName: msg.modelName,
        }
      }
      if (msg.modelName && !currentWork.modelName) {
        currentWork.modelName = msg.modelName
      }
      if (isTurnStreaming) {
        currentWork.isStreaming = true
      }
      if (isThought && msg.content.trim()) {
        currentWork.thoughts.push(msg.content.trim())
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        currentWork.toolCalls.push(...msg.toolCalls)
      }
      continue
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      if (!currentWork) {
        const tsNum =
          typeof msg.timestamp === "number"
            ? msg.timestamp
            : Date.parse(String(msg.timestamp)) || undefined
        currentWork = {
          id: `work-${msg.id}`,
          toolCalls: [],
          thoughts: [],
          timestamp: msg.timestamp,
          isStreaming: isTurnStreaming,
          startTimestamp: tsNum,
        }
      }
      currentWork.toolCalls.push(...msg.toolCalls)
    }

    if (currentWork) {
      const tsNum =
        typeof msg.timestamp === "number"
          ? msg.timestamp
          : Date.parse(String(msg.timestamp)) || undefined
      if (tsNum) {
        currentWork.endTimestamp = tsNum
      }
    }

    if (currentWork && msg.modelName && !currentWork.modelName) {
      currentWork.modelName = msg.modelName
    }
    flushWork()

    result.push({
      type: "message",
      id: msg.id,
      message: msg,
      isStreaming: isTyping && isLastMessage,
      turnUserMessage: currentTurnUserMessage ?? undefined,
    })
  }

  flushWork()
  return result
}

function isLastAssistantMessageInTurn(
  items: GroupedChatItem[],
  index: number,
): boolean {
  for (let j = index + 1; j < items.length; j++) {
    const next = items[j]
    if (next.type === "message") {
      if (next.message.role === "user") {
        return true
      }
      if (next.message.role === "assistant") {
        return false
      }
    }
  }
  return true
}

function getTurnAssistantContent(
  items: GroupedChatItem[],
  index: number,
): string {
  const currentItem = items[index]
  if (currentItem?.type !== "message" || currentItem.message.role !== "assistant") {
    return ""
  }
  const turnUserId = currentItem.turnUserMessage?.id
  const contents: string[] = []
  for (const it of items) {
    if (it.type === "message" && it.message.role === "assistant") {
      const match = turnUserId
        ? it.turnUserMessage?.id === turnUserId
        : it.turnUserMessage === currentItem.turnUserMessage
      if (match && it.message.content) {
        contents.push(it.message.content)
      }
    }
  }
  return contents.length > 0 ? contents.join("\n\n") : currentItem.message.content
}

export function ChatPage() {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workspaceFileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasScrolled, setHasScrolled] = useState(false)
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [isTemporaryChat, setIsTemporaryChat] = useAtom(temporaryChatAtom)
  const [useMemory, setUseMemory] = useAtom(temporaryChatUseMemoryAtom)
  const [saveMemoryAndFiles, setSaveMemoryAndFiles] = useAtom(
    temporaryChatSaveMemoryAndFilesAtom,
  )
  const [isConfirmingExitTemp, setIsConfirmingExitTemp] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const { speakingMessageId, speak, ttsSettings } = useSpeechSynthesis()
  const [lastInputWasVoice, setLastInputWasVoice] = useAtom(lastInputWasVoiceAtom)
  const messageWasVoiceRef = useRef(false)

  const {
    messages,
    connectionState,
    isTyping,
    activeSessionId,
    contextUsage,
    connect,
    sendMessage,
    newChat,
    startTemporaryChat,
    endTemporaryChat,
    stopTurn,
    switchBranch,
    regenerateTurn,
    editTurn,
  } = usePicoChat()

  const groupedChatItems = useMemo(
    () => groupChatMessages(messages, isTyping),
    [messages, isTyping],
  )

  const isAgentWorking = useMemo(() => {
    if (connectionState !== "connected") return false
    if (isTyping) return true
    if (messages.length === 0) return false

    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === "user") return true

    if (groupedChatItems.some((item) => item.isStreaming)) return true

    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i
        break
      }
    }

    if (lastUserIdx !== -1) {
      let hasFinishedNormal = false
      for (let i = lastUserIdx + 1; i < messages.length; i++) {
        const m = messages[i]
        if (
          m.role === "assistant" &&
          m.kind !== "thought" &&
          m.kind !== "tool_calls" &&
          Boolean(m.content && m.content.trim())
        ) {
          hasFinishedNormal = true
          break
        }
      }
      if (!hasFinishedNormal) return true
    }

    if (
      lastMsg.role === "assistant" &&
      (lastMsg.kind === "thought" ||
        lastMsg.kind === "tool_calls" ||
        (Boolean(lastMsg.toolCalls && lastMsg.toolCalls.length > 0) &&
          !lastMsg.content.trim()))
    ) {
      return true
    }

    return false
  }, [connectionState, isTyping, messages, groupedChatItems])

  const prevWorkingRef = useRef(false)
  const lastSpokenMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    const autoReadActive =
      ttsSettings?.autoReadOnMic ?? ttsSettings?.autoRead ?? false
    if (
      prevWorkingRef.current &&
      !isAgentWorking &&
      autoReadActive &&
      ttsSettings?.enabled
    ) {
      const lastMsg = messages[messages.length - 1]
      if (
        lastMsg &&
        lastMsg.role === "assistant" &&
        lastMsg.content.trim() &&
        lastMsg.id !== lastSpokenMessageIdRef.current &&
        messageWasVoiceRef.current
      ) {
        lastSpokenMessageIdRef.current = lastMsg.id
        messageWasVoiceRef.current = false
        speak(lastMsg.id, lastMsg.content)
      }
    }
    prevWorkingRef.current = isAgentWorking
  }, [
    isAgentWorking,
    messages,
    speak,
    ttsSettings?.autoReadOnMic,
    ttsSettings?.autoRead,
    ttsSettings?.enabled,
  ])

  const { state: gwState } = useGateway()
  const isGatewayRunning = gwState === "running"

  const {
    defaultModelName,
    currentModel,
    hasAvailableModels,
    apiKeyModels,
    oauthModels,
    localModels,
    settingDefault,
    handleSetDefault,
    handleUpdateThinking,
  } = useChatModels({ isConnected: isGatewayRunning })
  const hasDefaultModel = Boolean(defaultModelName) || hasAvailableModels
  const inputDisabledReason = resolveChatInputDisabledReason({
    hasDefaultModel,
    connectionState,
    gatewayState: gwState,
  })
  const canInput = inputDisabledReason === null

  useEffect(() => {
    if (
      isGatewayRunning &&
      connectionState !== "connected" &&
      connectionState !== "connecting"
    ) {
      void connect()
    }
  }, [isGatewayRunning, connectionState, connect])



  const userScrolledUpRef = useRef(false)

  const syncScrollState = (element: HTMLDivElement) => {
    const { clientHeight, scrollHeight, scrollTop } = element
    setHasScrolled(scrollTop > 0)
    const atBottom = scrollHeight - scrollTop <= clientHeight + 35
    setIsAtBottom(atBottom)
    if (!atBottom) {
      userScrolledUpRef.current = true
    } else {
      userScrolledUpRef.current = false
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    syncScrollState(e.currentTarget)
  }

  const scrollToBottom = (smooth = true) => {
    userScrolledUpRef.current = false
    setIsAtBottom(true)
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      })
    }
  }

  useEffect(() => {
    if (!scrollRef.current) return
    if (messages.length === 0) {
      scrollRef.current.scrollTop = 0
      userScrolledUpRef.current = false
      return
    }

    if (!userScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])


  const handleToggleTemporaryChat = async () => {
    if (isTemporaryChat) {
      setIsTemporaryChat(false)
      await endTemporaryChat(activeSessionId)
    } else {
      setIsTemporaryChat(true)
      await startTemporaryChat()
    }
  }

  const requestToggleTemporaryChat = () => {
    if (isTemporaryChat) {
      if (messages.length > 0) {
        setIsConfirmingExitTemp(true)
      } else {
        void handleToggleTemporaryChat()
      }
    } else {
      void handleToggleTemporaryChat()
    }
  }

  const handleStop = () => {
    stopTurn()
  }

  const handleSwitchBranch = (turnRootId: string, targetIndex: number) => {
    switchBranch(turnRootId, targetIndex)
  }

  const handleRegenerate = (assistantMessageId: string) => {
    regenerateTurn(assistantMessageId)
  }

  const handleEditUserMessage = (userMessageId: string, newText: string) => {
    editTurn(userMessageId, newText)
  }

  const handleNewChat = async () => {
    userScrolledUpRef.current = false
    setIsAtBottom(true)
    if (isTemporaryChat) {
      await endTemporaryChat(activeSessionId)
      setIsTemporaryChat(false)
    } else {
      await newChat()
    }
  }



  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || !canInput) return

    if (connectionState !== "connected") {
      toast.info(t("chat.disabledPlaceholder.websocketConnecting"))
      void connect()
      return
    }

    const wasVoice = lastInputWasVoice
    if (
      sendMessage({
        content: input,
        attachments,
        temporary: isTemporaryChat,
      })
    ) {
      messageWasVoiceRef.current = wasVoice
      setLastInputWasVoice(false)
      setInput("")
      setAttachments([])
      scrollToBottom(true)
    } else {
      toast.error(t("chat.notConnected"))
      void connect()
    }
  }

  const handleAddImages = () => {
    if (!canInput) return
    fileInputRef.current?.click()
  }

  const handleAddWorkspaceFile = () => {
    if (!canInput) return
    workspaceFileInputRef.current?.click()
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const appendImageFiles = async (files: readonly File[]) => {
    if (!canInput || files.length === 0) {
      return
    }

    const nextAttachments = await buildChatImageAttachments(files, t)
    if (nextAttachments.length === 0) {
      return
    }

    setAttachments((prev) => [...prev, ...nextAttachments])
  }

  const appendWorkspaceFiles = async (files: readonly File[]) => {
    if (!canInput || files.length === 0) {
      return
    }

    for (const file of files) {
      try {
        const res = await uploadToWorkspace(file)
        setAttachments((prev) => [
          ...prev,
          {
            type: "file",
            filename: res.filename,
            url: res.path,
            contentType: file.type,
          },
        ])
        toast.success(
          t("chat.fileUploaded", "Uploaded {{filename}} to workspace", {
            filename: res.filename,
          }),
        )
      } catch (err) {
        toast.error(
          t("chat.fileUploadFailed", "Failed to upload {{filename}}: {{error}}", {
            filename: file.name,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    }
  }

  const handleImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) {
      return
    }

    await appendImageFiles(files)
  }

  const handleWorkspaceFileSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) {
      return
    }

    await appendWorkspaceFiles(files)
  }

  const resetDragState = () => {
    dragDepthRef.current = 0
    setIsDragActive(false)
  }

  const handleComposerPaste = async (
    event: ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const files = getTransferredFiles(event.clipboardData)
    if (files.length === 0) {
      return
    }

    const imageFiles = files.filter((f) => f.type.startsWith("image/"))
    const nonImageFiles = files.filter((f) => !f.type.startsWith("image/"))

    if (imageFiles.length > 0) {
      await appendImageFiles(imageFiles)
    }
    if (nonImageFiles.length > 0) {
      await appendWorkspaceFiles(nonImageFiles)
    }
  }

  const handleComposerDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    if (!canInput) {
      return
    }
    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  const handleComposerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    if (!canInput) {
      resetDragState()
      return
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }

  const handleComposerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = canInput ? "copy" : "none"
  }

  const handleComposerDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    const files = getTransferredFiles(event.dataTransfer)
    resetDragState()

    if (!canInput || files.length === 0) {
      return
    }

    const imageFiles = files.filter((f) => f.type.startsWith("image/"))
    const nonImageFiles = files.filter((f) => !f.type.startsWith("image/"))

    if (imageFiles.length > 0) {
      await appendImageFiles(imageFiles)
    }
    if (nonImageFiles.length > 0) {
      await appendWorkspaceFiles(nonImageFiles)
    }
  }

  const canSubmit =
    canInput && (Boolean(input.trim()) || attachments.length > 0)

  return (
    <div className="bg-background/95 flex h-full flex-col">
      <PageHeader
        title={t("navigation.chat")}
        className={`transition-shadow ${
          hasScrolled ? "shadow-xs" : "shadow-none"
        }`}
        titleExtra={
          hasAvailableModels ? (
            <div className="flex items-center min-w-0 flex-1 max-w-fit">
              <ModelSelector
                defaultModelName={defaultModelName}
                apiKeyModels={apiKeyModels}
                oauthModels={oauthModels}
                localModels={localModels}
                disabled={settingDefault}
                onValueChange={handleSetDefault}
              />
            </div>
          ) : null
        }
      >
        {/* Temporary Chat Toggle: hidden once messages exist */}
        {messages.length === 0 && (
          <Button
            variant={isTemporaryChat ? "default" : "secondary"}
            size="sm"
            onClick={requestToggleTemporaryChat}
            className={`h-8 gap-1.5 px-2 sm:px-3 text-xs transition-all ${
              isTemporaryChat
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-1 ring-amber-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={
              isTemporaryChat
                ? "Temporary Chat is active (chat won't be saved). Click to turn off."
                : "Temporary Chat: Chat history is not saved in this mode"
            }
            aria-label="Temporary Chat"
          >
            <IconGhost
              className={`size-3.5 sm:size-4 ${isTemporaryChat ? "animate-pulse text-amber-200" : ""}`}
            />
            <span className="hidden sm:inline">
              {isTemporaryChat ? "Temporary On" : "Temporary Chat"}
            </span>
          </Button>
        )}

        {/* New Chat Button at Top Right */}
        <Button
          variant="default"
          size="sm"
          onClick={handleNewChat}
          className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs font-semibold px-2 sm:px-3 text-xs shrink-0"
          title={t("chat.newChat")}
        >
          <IconPlus className="size-3.5 sm:size-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>

        {/* More options 3-dot button AFTER New Chat button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={rulesOpen ? "secondary" : "outline"}
              size="sm"
              className={`h-8 w-8 p-0 shrink-0 shadow-xs transition-colors ${
                rulesOpen
                  ? "bg-accent text-accent-foreground border-primary/40 ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="More options"
              aria-label="More options"
            >
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1">
            <DropdownMenuItem
              onClick={() => setRulesOpen((prev) => !prev)}
              className="gap-2.5 cursor-pointer py-2"
            >
              <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <IconScale className="size-3.5" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">Rules</span>
                  {rulesOpen && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      Active
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">Global model rules</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Main Content Area: Chat + Inline Right Panel */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        <div className="flex flex-1 min-w-0 flex-col min-h-0 relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={`min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto px-4 py-6 md:px-8 ${
              rulesOpen ? "lg:px-12 xl:px-20" : "lg:px-24 xl:px-48"
            }`}
          >
        <div className="mx-auto flex w-full max-w-250 flex-col gap-8 pb-8">
          {/* Temporary Chat Banner & Memory/File Controls */}
          {isTemporaryChat && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 text-xs shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
                  <IconGhost className="size-4 shrink-0 text-amber-500 animate-pulse" />
                  <span>Temporary Chat Active</span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px] py-0 px-1.5"
                  >
                    Not Saved to History
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestToggleTemporaryChat}
                  className="h-7 px-2 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-semibold"
                >
                  Turn off
                </Button>
              </div>

              {/* Memory and file persistence switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-background/80 border border-amber-500/25">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">
                      Use Memory
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {useMemory
                        ? "Recalls past long-term memories"
                        : "Starts fresh without prior memory"}
                    </p>
                    {messages.length > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Settings locked during active chat
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={useMemory}
                    onCheckedChange={setUseMemory}
                    disabled={messages.length > 0}
                    aria-label="Toggle Use Memory"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-background/80 border border-amber-500/25">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">
                      Save Memory & Files
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {saveMemoryAndFiles
                        ? "Allowed to store memories or write files"
                        : "Strictly forbidden to save memory or files"}
                    </p>
                    {messages.length > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Settings locked during active chat
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={saveMemoryAndFiles}
                    onCheckedChange={setSaveMemoryAndFiles}
                    disabled={messages.length > 0}
                    aria-label="Toggle Save Memory & Files"
                  />
                </div>
              </div>
            </div>
          )}

          {messages.length === 0 && !isTyping && (
            <ChatEmptyState
              hasAvailableModels={hasAvailableModels}
              defaultModelName={defaultModelName}
              isConnected={isGatewayRunning}
              onSelectPrompt={(text) => setInput(text)}
            />
          )}

          {groupedChatItems.map((item, index) => {
            if (item.type === "work") {
              const modelToMention =
                item.modelName || defaultModelName || ""
              const formattedTs = item.timestamp
                ? formatMessageTime(item.timestamp)
                : ""

              return (
                <div key={item.id} className="w-full space-y-1">
                  <div className="text-muted-foreground/60 flex items-center justify-between gap-2 px-1 text-xs opacity-70">
                    <div className="flex items-center gap-2">
                      <span>PicoClaw</span>
                      {modelToMention && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="font-mono">{modelToMention}</span>
                        </>
                      )}
                      {formattedTs && (
                        <>
                          <span className="opacity-50">•</span>
                          <span>{formattedTs}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <WorkedSectionGroup
                    toolCalls={item.toolCalls}
                    thoughtContent={item.thoughtContent}
                    modelName={modelToMention}
                    timestamp={item.timestamp}
                    isStreaming={item.isStreaming}
                    durationMs={item.durationMs}
                  />
                </div>
              )
            }

            const { message } = item
            const prevItem = index > 0 ? groupedChatItems[index - 1] : null
            const hasPrecedingWork = prevItem?.type === "work"
            const isTurnEditBranch = Boolean(
              item.turnUserMessage?.branchType === "edit" ||
                message.branchType === "edit" ||
                item.turnUserMessage?.branches?.some(
                  (b) => b[0]?.branchType === "edit",
                ) ||
                (item.turnUserMessage?.branches &&
                  item.turnUserMessage.branches.length > 1 &&
                  item.turnUserMessage.branches.some(
                    (b) =>
                      b[0]?.content.trim() !==
                      item.turnUserMessage?.branches?.[0]?.[0]?.content.trim(),
                  )),
            )
            const isUserEditBranch = Boolean(
              message.branchType === "edit" ||
                message.branches?.some((b) => b[0]?.branchType === "edit") ||
                (message.branches &&
                  message.branches.length > 1 &&
                  message.branches.some(
                    (b) =>
                      b[0]?.content.trim() !==
                      message.branches?.[0]?.[0]?.content.trim(),
                  )),
            )

            const isFollowUpAssistant =
              prevItem?.type === "message" &&
              prevItem.message.role === "assistant" &&
              (item.turnUserMessage?.id
                ? prevItem.turnUserMessage?.id === item.turnUserMessage?.id
                : prevItem.turnUserMessage === item.turnUserMessage)
            const isLastAssistantInTurn = isLastAssistantMessageInTurn(
              groupedChatItems,
              index,
            )
            const turnAssistantContent = getTurnAssistantContent(
              groupedChatItems,
              index,
            )

            return (
              <div
                key={item.id}
                className={`w-full ${isFollowUpAssistant ? "-mt-5" : ""}`}
              >
                {message.role === "assistant" ? (
                  <AssistantMessage
                    id={message.id}
                    content={message.content}
                    attachments={message.attachments}
                    kind={message.kind}
                    modelName={message.modelName || defaultModelName}
                    toolCalls={undefined}
                    timestamp={message.timestamp}
                    isStreaming={item.isStreaming}
                    hideHeader={hasPrecedingWork || isFollowUpAssistant}
                    showBottomActions={isLastAssistantInTurn}
                    copyContent={turnAssistantContent}
                    totalBranches={
                      !isTurnEditBranch
                        ? (item.turnUserMessage?.branches?.length ?? 1)
                        : 1
                    }
                    currentBranchIndex={
                      item.turnUserMessage?.activeBranchIndex ?? 0
                    }
                    isBranchLocked={isAgentWorking}
                    onSwitchBranch={
                      item.turnUserMessage
                        ? (targetIndex) =>
                            handleSwitchBranch(
                              item.turnUserMessage!.id,
                              targetIndex,
                            )
                        : undefined
                    }
                    onRegenerate={() => handleRegenerate(message.id)}
                    speakingMessageId={speakingMessageId}
                    onReadAloud={
                      ttsSettings?.enabled
                        ? (text) => speak(message.id, text)
                        : undefined
                    }
                  />
                ) : (
                  <UserMessage
                    id={message.id}
                    content={message.content}
                    attachments={message.attachments}
                    timestamp={message.timestamp}
                    totalBranches={
                      isUserEditBranch ? (message.branches?.length ?? 1) : 1
                    }
                    currentBranchIndex={message.activeBranchIndex ?? 0}
                    isBranchLocked={isAgentWorking}
                    onSwitchBranch={(targetIndex) =>
                      handleSwitchBranch(message.id, targetIndex)
                    }
                    onEdit={(newText) =>
                      handleEditUserMessage(message.id, newText)
                    }
                  />
                )}
              </div>
            )
          })}

          {isAgentWorking &&
            (messages.length === 0 ||
              messages[messages.length - 1]?.role === "user") && (
              <TypingIndicator />
            )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={CHAT_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={handleImageSelection}
      />

      <input
        ref={workspaceFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleWorkspaceFileSelection}
      />

      <ChatComposer
        input={input}
        attachments={attachments}
        onInputChange={setInput}
        onAddImages={handleAddImages}
        onCaptureImage={(file) => void appendImageFiles([file])}
        onUploadFile={handleAddWorkspaceFile}
        onPaste={handleComposerPaste}
        onDragEnter={handleComposerDragEnter}
        onDragLeave={handleComposerDragLeave}
        onDragOver={handleComposerDragOver}
        onDrop={handleComposerDrop}
        onRemoveAttachment={handleRemoveAttachment}
        onSend={handleSend}
        onStop={handleStop}
        isWorking={isAgentWorking}
        onContextDetail={() => {
          if (sendMessage({ content: "/context", attachments: [] })) {
            setInput("")
          }
        }}
        inputDisabledReason={inputDisabledReason}
        canSend={canSubmit}
        isDragActive={isDragActive}
        contextUsage={contextUsage}
        thinkingLevel={currentModel?.thinking_level ?? ""}
        onUpdateThinkingLevel={handleUpdateThinking}
      />

      {!isAtBottom && messages.length > 0 && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => scrollToBottom(true)}
            className="pointer-events-auto shadow-md gap-1.5 rounded-full border border-border/70 bg-card/95 backdrop-blur-md px-3.5 h-7 text-xs text-foreground hover:bg-muted font-medium"
          >
            <IconChevronDown className="size-3.5" />
            <span>Latest messages</span>
          </Button>
        </div>
      )}

        </div>

        {/* Inline Right Navigation / Sidebar Panel */}
        {rulesOpen && (
          <RulesPanel onClose={() => setRulesOpen(false)} />
        )}
      </div>

      {/* Confirmation Dialog for Exiting Temporary Chat */}
      <AlertDialog
        open={isConfirmingExitTemp}
        onOpenChange={setIsConfirmingExitTemp}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Temporary Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in this temporary chat will disappear and cannot be recovered. Are you sure you want to turn off temporary mode?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsConfirmingExitTemp(false)
                await handleToggleTemporaryChat()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Chat & Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
