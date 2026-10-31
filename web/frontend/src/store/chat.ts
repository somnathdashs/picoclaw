import { atom, getDefaultStore } from "jotai"
import { atomWithStorage } from "jotai/utils"

import {
  ASSISTANT_DETAIL_VISIBILITY_STORAGE_KEY,
  type AssistantDetailVisibility,
  DEFAULT_ASSISTANT_DETAIL_VISIBILITY,
  assistantDetailVisibilityStorage,
  shouldShowAssistantMessage,
} from "@/features/chat/detail-visibility"
import {
  clearStoredSessionId,
  getInitialActiveSessionId,
  readStoredSessionId,
  writeStoredSessionId,
} from "@/features/chat/state"

export interface ChatAttachment {
  type: "image" | "audio" | "video" | "file"
  url: string
  filename?: string
  contentType?: string
}

export interface ChatToolCallFunction {
  name?: string
  arguments?: string
}

export interface ChatToolCallExtraContent {
  toolFeedbackExplanation?: string
  result?: unknown
  output?: unknown
}

export interface ChatToolCall {
  id?: string
  type?: string
  function?: ChatToolCallFunction
  extraContent?: ChatToolCallExtraContent
  result?: unknown
  output?: unknown
  response?: unknown
  content?: unknown
}

export type AssistantMessageKind = "normal" | "thought" | "tool_calls"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number | string
  kind?: AssistantMessageKind
  modelName?: string
  attachments?: ChatAttachment[]
  toolCalls?: ChatToolCall[]
  branches?: ChatMessage[][]
  activeBranchIndex?: number
  branchType?: "edit" | "regeneration"
}

export interface ContextUsage {
  used_tokens: number
  total_tokens: number
  history_tokens?: number
  compress_at_tokens: number
  summarize_at_tokens?: number
  used_percent: number
}

export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "error"

export interface ChatStoreState {
  messages: ChatMessage[]
  connectionState: ConnectionState
  isTyping: boolean
  activeSessionId: string
  hasHydratedActiveSession: boolean
  contextUsage?: ContextUsage
}

type ChatStorePatch = Partial<ChatStoreState>

const DEFAULT_CHAT_STATE: ChatStoreState = {
  messages: [],
  connectionState: "disconnected",
  isTyping: false,
  activeSessionId: getInitialActiveSessionId(),
  hasHydratedActiveSession: false,
}

export const chatAtom = atom<ChatStoreState>(DEFAULT_CHAT_STATE)
export const assistantDetailVisibilityAtom =
  atomWithStorage<AssistantDetailVisibility>(
    ASSISTANT_DETAIL_VISIBILITY_STORAGE_KEY,
    DEFAULT_ASSISTANT_DETAIL_VISIBILITY,
    assistantDetailVisibilityStorage,
    { getOnInit: true },
  )
export const showAssistantDetailsAtom = atom(
  (get) => get(assistantDetailVisibilityAtom) !== "none",
)
export const temporaryChatAtom = atom<boolean>(false)
export const temporaryChatUseMemoryAtom = atom<boolean>(false)
export const temporaryChatSaveMemoryAndFilesAtom = atom<boolean>(false)
export const sessionListRevisionAtom = atom<number>(0)

export interface LocalSessionMeta {
  id: string
  title: string
  preview: string
  updated: number
}
export const localSessionsAtom = atom<Record<string, LocalSessionMeta>>({})

const store = getDefaultStore()

export function bumpSessionListRevision() {
  store.set(sessionListRevisionAtom, (rev) => rev + 1)
}

export function recordLocalSession(id: string, text: string) {
  if (!id || id.startsWith("temp-") || id.startsWith("temporary-") || id.includes(":temp-") || id.includes(":temporary-")) return
  const clean = text.trim()
  if (!clean) return
  writeStoredSessionId(id)
  store.set(localSessionsAtom, (prev) => {
    const existing = prev[id]
    return {
      ...prev,
      [id]: {
        id,
        title: existing?.title || clean.slice(0, 40),
        preview: clean.slice(0, 80),
        updated: Date.now(),
      },
    }
  })
  bumpSessionListRevision()
}

export function deleteLocalSession(id: string) {
  if (readStoredSessionId() === id) {
    clearStoredSessionId()
  }
  store.set(localSessionsAtom, (prev) => {
    if (!prev[id]) return prev
    const next = { ...prev }
    delete next[id]
    return next
  })
  bumpSessionListRevision()
}

export function clearAllLocalSessions(type?: string) {
  if (!type || type === "all" || type === "web") {
    clearStoredSessionId()
    store.set(localSessionsAtom, {})
  }
  bumpSessionListRevision()
}

export function getChatState() {
  return store.get(chatAtom)
}

export function updateChatStore(
  patch:
    | ChatStorePatch
    | ((prev: ChatStoreState) => ChatStorePatch | ChatStoreState),
) {
  store.set(chatAtom, (prev) => {
    const nextPatch = typeof patch === "function" ? patch(prev) : patch
    const next = { ...prev, ...nextPatch }

    if (next.activeSessionId !== prev.activeSessionId) {
      if (next.messages.length > 0) {
        writeStoredSessionId(next.activeSessionId)
      } else {
        clearStoredSessionId()
      }
    } else if (next.messages.length > 0 && prev.messages.length === 0) {
      writeStoredSessionId(next.activeSessionId)
    }

    return next
  })
}

export { shouldShowAssistantMessage, DEFAULT_ASSISTANT_DETAIL_VISIBILITY }
export type { AssistantDetailVisibility }

