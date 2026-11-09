import { getDefaultStore } from "jotai"
import { toast } from "sonner"

import { deleteSession, saveSessionBranchTurns, switchSessionBranch } from "@/api/sessions"
import { cleanAttachmentFilename, loadSessionMessages, mergeHistoryMessages } from "@/features/chat/history"
import {
  extractBranchTurns,
  formatBranchHistory,
  reconstructBranchesFromHistory,
  syncActiveBranches,
} from "@/features/chat/branches"
import {
  type PicoMessage,
  handlePicoMessage,
  reducePicoMessage,
} from "@/features/chat/protocol"
import {
  clearStoredSessionId,
  generateSessionId,
  generateTemporarySessionId,
  readStoredSessionId,
  writeStoredSessionId,
} from "@/features/chat/state"
import { invalidateSocket } from "@/features/chat/websocket"
import i18n from "@/i18n"
import {
  type ChatAttachment,
  type ChatMessage,
  bumpSessionListRevision,
  deleteLocalSession,
  getChatState,
  recordLocalSession,
  updateChatStore,
} from "@/store/chat"

import { type GatewayState, gatewayAtom } from "@/store/gateway"

const store = getDefaultStore()

const sessionSockets = new Map<string, WebSocket>()
const sessionTypingMap = new Map<string, boolean>()
const sessionMessagesMap = new Map<string, ChatMessage[]>()

export function clearSessionBranches(sessionId: string) {
  sessionMessagesMap.delete(sessionId)
}

export function clearAllSessionBranches() {
  sessionMessagesMap.clear()
}

export function syncBranchesToGateway(sessionId: string) {
  if (!sessionId || sessionId.startsWith("temp-")) return
  const currentMessages = sessionMessagesMap.get(sessionId) ?? getChatState().messages
  const turns = extractBranchTurns(syncActiveBranches(currentMessages))
  if (turns.length > 0) {
    void saveSessionBranchTurns(sessionId, turns).catch(() => {})
  }
}

let msgIdCounter = 0
let activeSessionIdRef = getChatState().activeSessionId
let initialized = false
let unsubscribeGateway: (() => void) | null = null
let hydratePromise: Promise<void> | null = null
let reconnectTimer: number | null = null
let reconnectAttempts = 0
let shouldMaintainConnection = false

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function shouldReconnectFor(sessionId: string): boolean {
  return (
    shouldMaintainConnection &&
    sessionId === activeSessionIdRef &&
    store.get(gatewayAtom).status === "running"
  )
}

function scheduleReconnect(sessionId: string) {
  if (!shouldReconnectFor(sessionId) || reconnectTimer !== null) {
    return
  }

  const delay = Math.min(1000 * 2 ** reconnectAttempts, 5000)
  reconnectAttempts += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    if (!shouldReconnectFor(sessionId)) {
      return
    }
    void connectChat()
  }, delay)
}

function needsActiveSessionHydration(): boolean {
  const state = getChatState()
  const storedSessionId = readStoredSessionId()

  return Boolean(
    storedSessionId &&
    storedSessionId === state.activeSessionId &&
    !state.hasHydratedActiveSession,
  )
}

function setActiveSessionId(sessionId: string) {
  activeSessionIdRef = sessionId
  writeStoredSessionId(sessionId)
  updateChatStore({ activeSessionId: sessionId })
}

export function getSessionSocket(sessionId: string): WebSocket | null {
  const existing = sessionSockets.get(sessionId)
  if (
    existing &&
    (existing.readyState === WebSocket.OPEN ||
      existing.readyState === WebSocket.CONNECTING)
  ) {
    return existing
  }
  return null
}

export function connectSessionSocket(sessionId: string): WebSocket | null {
  if (store.get(gatewayAtom).status !== "running" || !sessionId) {
    return null
  }

  const existing = getSessionSocket(sessionId)
  if (existing) {
    if (activeSessionIdRef === sessionId && existing.readyState === WebSocket.OPEN) {
      updateChatStore({ connectionState: "connected" })
    }
    return existing
  }

  const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${wsScheme}//${window.location.host}/pico/ws`
  const url = `${wsUrl}?session_id=${encodeURIComponent(sessionId)}`
  const socket = new WebSocket(url)

  sessionSockets.set(sessionId, socket)

  if (activeSessionIdRef === sessionId) {
    updateChatStore({ connectionState: "connecting" })
  }

  socket.onopen = () => {
    if (activeSessionIdRef === sessionId) {
      updateChatStore({ connectionState: "connected" })
      reconnectAttempts = 0
    }
  }

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as PicoMessage
      if (sessionId === activeSessionIdRef) {
        handlePicoMessage(message, sessionId)
        sessionTypingMap.set(sessionId, getChatState().isTyping)
        sessionMessagesMap.set(sessionId, getChatState().messages)
        if (message.type === "typing.stop") {
          syncBranchesToGateway(sessionId)
        }
      } else {
        const cached = sessionMessagesMap.get(sessionId) ?? []
        const wasTyping = sessionTypingMap.get(sessionId) ?? true
        const result = reducePicoMessage(cached, wasTyping, message)
        sessionMessagesMap.set(sessionId, result.messages)
        sessionTypingMap.set(sessionId, result.isTyping)
        if (message.type === "typing.stop") {
          syncBranchesToGateway(sessionId)
        }
        bumpSessionListRevision()
      }
    } catch {
      console.warn("Non-JSON message from pico:", event.data)
    }
  }

  socket.onclose = () => {
    if (sessionSockets.get(sessionId) === socket) {
      sessionSockets.delete(sessionId)
    }
    sessionTypingMap.set(sessionId, false)
    if (activeSessionIdRef === sessionId) {
      updateChatStore({
        connectionState: "disconnected",
        isTyping: false,
      })
      if (shouldMaintainConnection) {
        scheduleReconnect(sessionId)
      }
    }
  }

  socket.onerror = () => {
    if (activeSessionIdRef === sessionId) {
      updateChatStore({ connectionState: "error" })
      scheduleReconnect(sessionId)
    }
  }

  return socket
}

function disconnectChatInternal({
  clearDesiredConnection,
}: {
  clearDesiredConnection: boolean
}) {
  clearReconnectTimer()

  if (clearDesiredConnection) {
    shouldMaintainConnection = false
    for (const [, sock] of sessionSockets.entries()) {
      invalidateSocket(sock)
    }
    sessionSockets.clear()
    sessionTypingMap.clear()
  } else {
    const activeSock = sessionSockets.get(activeSessionIdRef)
    if (activeSock && !sessionTypingMap.get(activeSessionIdRef)) {
      invalidateSocket(activeSock)
      sessionSockets.delete(activeSessionIdRef)
    }
  }

  updateChatStore({
    connectionState: "disconnected",
    isTyping: sessionTypingMap.get(activeSessionIdRef) ?? false,
  })
}

export async function connectChat() {
  if (
    store.get(gatewayAtom).status !== "running" ||
    needsActiveSessionHydration()
  ) {
    return
  }

  shouldMaintainConnection = true
  connectSessionSocket(activeSessionIdRef)
}


export function disconnectChat() {
  disconnectChatInternal({ clearDesiredConnection: true })
}

export async function hydrateActiveSession() {
  if (hydratePromise) {
    return hydratePromise
  }

  const state = getChatState()
  const storedSessionId = readStoredSessionId()

  if (
    !storedSessionId ||
    state.hasHydratedActiveSession ||
    storedSessionId !== state.activeSessionId
  ) {
    if (!state.hasHydratedActiveSession) {
      updateChatStore({ hasHydratedActiveSession: true })
    }
    return
  }

  hydratePromise = loadSessionMessages(storedSessionId)
    .then((historyMessages) => {
      const currentState = getChatState()
      if (currentState.activeSessionId !== storedSessionId) return

      const reconstructed = reconstructBranchesFromHistory(historyMessages)
      sessionMessagesMap.set(storedSessionId, reconstructed)

      // If current state already has messages, merge with history so in-flight messages are preserved
      if (currentState.messages.length > 0) {
        const merged = mergeHistoryMessages(reconstructed, currentState.messages)
        updateChatStore({
          messages: merged,
          hasHydratedActiveSession: true,
        })
        return
      }

      updateChatStore({
        messages: reconstructed,
        isTyping: false,
        hasHydratedActiveSession: true,
      })
    })
    .catch((error) => {
      const is404 = String(error).includes("404")
      if (!is404) {
        console.warn("Failed to restore last session history:", error)
      }

      const currentState = getChatState()
      if (currentState.activeSessionId !== storedSessionId) return

      // Don't wipe in-flight messages if history fails to load
      if (currentState.messages.length > 0) {
        updateChatStore({ hasHydratedActiveSession: true })
        return
      }

      deleteLocalSession(storedSessionId)
      clearStoredSessionId()
      const freshId = generateSessionId()
      activeSessionIdRef = freshId
      updateChatStore({
        activeSessionId: freshId,
        messages: [],
        isTyping: false,
        hasHydratedActiveSession: true,
      })
    })
    .finally(() => {
      hydratePromise = null
    })

  return hydratePromise
}

interface SendChatMessageInput {
  content: string
  displayContent?: string
  attachments?: ChatAttachment[]
  temporary?: boolean
  temporarySettings?: {
    useMemory?: boolean
    saveMemoryAndFiles?: boolean
  }
}

function attachFileTagsToContent(
  content: string,
  attachments: readonly ChatAttachment[] = [],
): string {
  const normalized = content.trim()
  const fileAttachments = attachments.filter(
    (att) => att.type === "file" && (att.filename || att.url || att.path),
  )
  if (fileAttachments.length === 0) {
    return normalized
  }

  const fileTags = fileAttachments
    .map((f) => {
      const filePath = f.path || f.url || f.filename
      return f.filename && filePath && filePath !== f.filename
        ? `${f.filename} [file:${filePath}]`
        : `[file:${filePath}]`
    })
    .join(" ")

  return normalized ? `${normalized}\n${fileTags}` : fileTags
}

export function sendChatMessage({
  content,
  displayContent,
  attachments = [],
  temporary = false,
  temporarySettings,
}: SendChatMessageInput) {
  const state = getChatState()
  const sessionId = state.activeSessionId

  let socket = getSessionSocket(sessionId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    if (store.get(gatewayAtom).status === "running") {
      socket = connectSessionSocket(sessionId)
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }
  }

  const normalizedContent = content.trim()
  const imageAttachments = attachments
    .filter((attachment) => attachment.type === "image" && attachment.url)
    .map((attachment) => ({ ...attachment }))
  const fileAttachments = attachments
    .filter((attachment) => attachment.type === "file" && (attachment.filename || attachment.url))
    .map((attachment) => ({ ...attachment }))

  if (!normalizedContent && imageAttachments.length === 0 && fileAttachments.length === 0) {
    return false
  }

  const isTemporary = Boolean(
    temporary ||
    sessionId.startsWith("temp-") ||
    sessionId.startsWith("temporary-") ||
    sessionId.includes(":temp-") ||
    sessionId.includes(":temporary-")
  )

  const id = `msg-${++msgIdCounter}-${Date.now()}`
  const branchHistory = formatBranchHistory(state.messages)
  const userText = displayContent?.trim() || normalizedContent

  const userMessage: ChatMessage = {
    id,
    role: "user",
    content: userText,
    attachments: attachments.length > 0 ? attachments : undefined,
    timestamp: Date.now(),
  }

  const nextMessages = [...state.messages, userMessage]
  sessionMessagesMap.set(sessionId, nextMessages)
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })
  sessionTypingMap.set(sessionId, true)
  if (!isTemporary) {
    recordLocalSession(sessionId, userText)
  }

  try {
    const outgoingContent = attachFileTagsToContent(normalizedContent, fileAttachments)

    const payload: Record<string, unknown> = {
      content: outgoingContent,
      media: imageAttachments.map((attachment) => attachment.url),
      attachments: attachments.map((att) => ({
        type: att.type,
        url: att.url,
        filename: cleanAttachmentFilename(att.filename),
        content_type: att.contentType,
        path: att.path,
        ref: att.path || att.url,
        size: att.size,
      })),
      branch_history: branchHistory,
      ...(isTemporary
        ? {
            temporary: true,
            use_memory: temporarySettings?.useMemory ?? false,
            save_memory_and_files: temporarySettings?.saveMemoryAndFiles ?? false,
          }
        : {}),
    }

    socket.send(
      JSON.stringify({
        type: "message.send",
        id,
        session_id: sessionId,
        payload,
      }),
    )
    return true
  } catch (error) {
    console.error("Failed to send pico message:", error)
    const rolledBack = state.messages.filter((message) => message.id !== id)
    updateChatStore({
      messages: rolledBack,
      isTyping: false,
    })
    sessionTypingMap.set(sessionId, false)
    return false
  }
}

export function stopAgentTurn() {
  const state = getChatState()
  const sessionId = state.activeSessionId
  const socket = getSessionSocket(sessionId)

  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(
        JSON.stringify({
          type: "message.send",
          id: `stop-${Date.now()}`,
          session_id: sessionId,
          payload: { content: "/stop" },
        }),
      )
    } catch (err) {
      console.warn("Failed to send stop command:", err)
    }
  }

  updateChatStore({ isTyping: false })
  sessionTypingMap.set(sessionId, false)
}



export function switchChatBranch(
  turnRootId: string,
  targetBranchIndex: number,
): boolean {
  const state = getChatState()
  if (state.isTyping) return false

  // Search by both the given ID and within branches (handles regenerated turns
  // where the active user message ID changed after branch creation)
  let idx = state.messages.findIndex((m) => m.id === turnRootId)
  if (idx < 0) {
    // Try to find via any branch root that has this ID stored
    idx = state.messages.findIndex(
      (m) => m.branches?.some((b) => b[0]?.id === turnRootId),
    )
  }
  if (idx < 0) return false

  const rootMsg = state.messages[idx]
  if (!rootMsg.branches || rootMsg.branches.length === 0) return false
  if (
    targetBranchIndex < 0 ||
    targetBranchIndex >= rootMsg.branches.length
  ) {
    return false
  }

  const currentBranchIdx = rootMsg.activeBranchIndex ?? 0
  if (currentBranchIdx === targetBranchIndex) return true

  // Save current active branch snapshot with cloned root
  const rawSnapshot = state.messages.slice(idx)
  const currentSnapshot: ChatMessage[] = rawSnapshot.length > 0
    ? [{ ...rawSnapshot[0], activeBranchIndex: currentBranchIdx }, ...rawSnapshot.slice(1)]
    : []

  const rawBranches = [...rootMsg.branches]
  rawBranches[currentBranchIdx] = currentSnapshot

  const targetBranch = rawBranches[targetBranchIndex]
  if (!targetBranch || targetBranch.length === 0) return false

  // Re-link all branch roots immutably
  const updatedBranches: ChatMessage[][] = []
  for (let b = 0; b < rawBranches.length; b++) {
    const branch = rawBranches[b]
    if (branch && branch[0]) {
      updatedBranches.push([
        {
          ...branch[0],
          branches: updatedBranches,
          activeBranchIndex: b,
          ...(rootMsg.branchType ? { branchType: rootMsg.branchType } : {}),
        },
        ...branch.slice(1),
      ])
    } else {
      updatedBranches.push(branch || [])
    }
  }

  const activeBranch = updatedBranches[targetBranchIndex]
  if (!activeBranch || activeBranch.length === 0) return false

  const nextMessages = [...state.messages.slice(0, idx), ...activeBranch]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({ messages: nextMessages })

  if (state.activeSessionId && !state.activeSessionId.startsWith("temp-")) {
    void switchSessionBranch(state.activeSessionId, turnRootId, targetBranchIndex).catch(() => {})
  }
  return true
}

export function regenerateAssistantTurn(assistantMessageId: string): boolean {
  const state = getChatState()
  if (state.isTyping) return false

  const aiIdx = state.messages.findIndex((m) => m.id === assistantMessageId)
  if (aiIdx < 0) return false

  let userIdx = -1
  for (let i = aiIdx - 1; i >= 0; i--) {
    if (state.messages[i].role === "user") {
      userIdx = i
      break
    }
  }
  if (userIdx < 0) return false

  const userMsg = state.messages[userIdx]
  const currentSnapshot = state.messages.slice(userIdx)

  const existingBranches: ChatMessage[][] = userMsg.branches
    ? [...userMsg.branches]
    : []
  const curIdx = existingBranches.length > 0 ? (userMsg.activeBranchIndex ?? 0) : 0

  // Clone root message to avoid mutating the shared store ref
  const snapshotRoot: ChatMessage = {
    ...(currentSnapshot[0] ?? userMsg),
    activeBranchIndex: curIdx,
    branchType: "regeneration",
  }
  const savedSnapshot: ChatMessage[] = currentSnapshot.length > 0
    ? [snapshotRoot, ...currentSnapshot.slice(1)]
    : [snapshotRoot]

  const branches: ChatMessage[][] = existingBranches.length === 0
    ? [savedSnapshot]
    : existingBranches.map((b, i) => i === curIdx ? savedSnapshot : b)

  const newBranchIndex = branches.length
  const newId = `msg-${++msgIdCounter}-${Date.now()}`

  // Build branches array before creating newMsg so the reference is stable
  const newMsg: ChatMessage = {
    ...userMsg,
    id: newId,
    timestamp: Date.now(),
    branches,
    activeBranchIndex: newBranchIndex,
    branchType: "regeneration",
  }

  branches.push([newMsg])
  // Update all branch roots to share the final branches array
  for (let b = 0; b < branches.length; b++) {
    if (branches[b][0]) {
      branches[b] = [
        { ...branches[b][0], branches, activeBranchIndex: b, branchType: "regeneration" },
        ...branches[b].slice(1),
      ]
    }
  }

  const nextMessages = [...state.messages.slice(0, userIdx), newMsg]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })

  if (state.activeSessionId && !state.activeSessionId.startsWith("temp-")) {
    const turns = extractBranchTurns(nextMessages)
    if (turns.length > 0) {
      void saveSessionBranchTurns(state.activeSessionId, turns).catch(() => {})
    }
  }

  const socket = getSessionSocket(state.activeSessionId)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    updateChatStore({ isTyping: false })
    return false
  }

  sessionTypingMap.set(state.activeSessionId, true)

  try {
    const outgoingContent = attachFileTagsToContent(
      newMsg.content,
      newMsg.attachments || [],
    )
    const payload: Record<string, unknown> = {
      content: outgoingContent,
      media: (newMsg.attachments || [])
        .filter((att) => att.type === "image" && att.url)
        .map((att) => att.url),
      attachments: (newMsg.attachments || []).map((att) => ({
        type: att.type,
        url: att.url,
        filename: att.filename,
        content_type: att.contentType,
        path: att.path,
        size: att.size,
      })),
      branch_history: formatBranchHistory(state.messages.slice(0, userIdx)),
    }

    socket.send(
      JSON.stringify({
        type: "message.send",
        id: newId,
        session_id: state.activeSessionId,
        payload,
      }),
    )
    return true
  } catch (error) {
    console.error("Failed to regenerate turn:", error)
    updateChatStore({ isTyping: false })
    sessionTypingMap.set(state.activeSessionId, false)
    return false
  }
}

export function editUserTurn(
  userMessageId: string,
  newText: string,
): boolean {
  const text = newText.trim()
  if (!text) return false

  const state = getChatState()
  const socket = getSessionSocket(state.activeSessionId)

  // If agent is active, send /stop to abort any ongoing work on the backend
  if (state.isTyping && socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(
        JSON.stringify({
          type: "message.send",
          id: `stop-${Date.now()}`,
          session_id: state.activeSessionId,
          payload: { content: "/stop" },
        }),
      )
    } catch {
      // ignore stop send failure
    }
  }

  const userIdx = state.messages.findIndex((m) => m.id === userMessageId)
  if (userIdx < 0) return false

  const userMsg = state.messages[userIdx]
  const currentSnapshot = state.messages.slice(userIdx)

  const existingBranches: ChatMessage[][] = userMsg.branches
    ? [...userMsg.branches]
    : []
  const curIdx = existingBranches.length > 0 ? (userMsg.activeBranchIndex ?? 0) : 0

  // Clone root message to avoid mutating shared store reference
  const snapshotRoot: ChatMessage = {
    ...(currentSnapshot[0] ?? userMsg),
    activeBranchIndex: curIdx,
    branchType: "edit",
  }
  const savedSnapshot: ChatMessage[] = currentSnapshot.length > 0
    ? [snapshotRoot, ...currentSnapshot.slice(1)]
    : [snapshotRoot]

  const branches: ChatMessage[][] = existingBranches.length === 0
    ? [savedSnapshot]
    : existingBranches.map((b, i) => i === curIdx ? savedSnapshot : b)

  const newBranchIndex = branches.length
  const newId = `msg-${++msgIdCounter}-${Date.now()}`
  const newMsg: ChatMessage = {
    ...userMsg,
    id: newId,
    content: text,
    timestamp: Date.now(),
    branches,
    activeBranchIndex: newBranchIndex,
    branchType: "edit",
  }

  branches.push([newMsg])
  for (let b = 0; b < branches.length; b++) {
    if (branches[b][0]) {
      branches[b] = [
        { ...branches[b][0], branches, activeBranchIndex: b, branchType: "edit" },
        ...branches[b].slice(1),
      ]
    }
  }

  const nextMessages = [...state.messages.slice(0, userIdx), newMsg]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })

  if (state.activeSessionId && !state.activeSessionId.startsWith("temp-")) {
    const turns = extractBranchTurns(nextMessages)
    if (turns.length > 0) {
      void saveSessionBranchTurns(state.activeSessionId, turns).catch(() => {})
    }
  }
  sessionTypingMap.set(state.activeSessionId, true)
  if (state.activeSessionId) {
    recordLocalSession(state.activeSessionId, text)
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    updateChatStore({ isTyping: false })
    sessionTypingMap.set(state.activeSessionId, false)
    return false
  }

  try {
    const outgoingContent = attachFileTagsToContent(
      text,
      newMsg.attachments || [],
    )
    const payload: Record<string, unknown> = {
      content: outgoingContent,
      media: (newMsg.attachments || [])
        .filter((att) => att.type === "image" && att.url)
        .map((att) => att.url),
      attachments: (newMsg.attachments || []).map((att) => ({
        type: att.type,
        url: att.url,
        filename: att.filename,
        content_type: att.contentType,
        path: att.path,
        size: att.size,
      })),
      branch_history: formatBranchHistory(state.messages.slice(0, userIdx)),
    }

    socket.send(
      JSON.stringify({
        type: "message.send",
        id: newId,
        session_id: state.activeSessionId,
        payload,
      }),
    )
    return true
  } catch (error) {
    console.error("Failed to edit turn:", error)
    updateChatStore({ isTyping: false })
    sessionTypingMap.set(state.activeSessionId, false)
    return false
  }
}

export async function switchChatSession(sessionId: string) {
  if (sessionId === activeSessionIdRef) {
    return
  }

  const currentState = getChatState()
  if (activeSessionIdRef) {
    if (currentState.messages.length > 0) {
      sessionMessagesMap.set(activeSessionIdRef, syncActiveBranches(currentState.messages))
    }
    sessionTypingMap.set(activeSessionIdRef, currentState.isTyping)

    const prevSocket = sessionSockets.get(activeSessionIdRef)
    if (prevSocket && !currentState.isTyping) {
      invalidateSocket(prevSocket)
      sessionSockets.delete(activeSessionIdRef)
    }
  }

  try {
    // Always fetch session chat fresh from Go DB (like main branch)
    const historyMessages = await loadSessionMessages(sessionId)
    const targetMessages = reconstructBranchesFromHistory(historyMessages)
    sessionMessagesMap.set(sessionId, targetMessages)
    const targetIsTyping = sessionTypingMap.get(sessionId) ?? false

    setActiveSessionId(sessionId)
    updateChatStore({
      messages: targetMessages,
      isTyping: targetIsTyping,
      hasHydratedActiveSession: true,
      contextUsage: undefined,
    })

    if (store.get(gatewayAtom).status === "running") {
      shouldMaintainConnection = true
      connectSessionSocket(sessionId)
    }
  } catch (error) {
    const is404 = String(error).includes("404")
    if (is404) {
      clearSessionBranches(sessionId)
      deleteLocalSession(sessionId)
      setActiveSessionId(sessionId)
      updateChatStore({
        messages: [],
        isTyping: false,
        hasHydratedActiveSession: true,
        contextUsage: undefined,
      })
      if (store.get(gatewayAtom).status === "running") {
        shouldMaintainConnection = true
        connectSessionSocket(sessionId)
      }
    } else {
      console.error("Failed to load session history:", error)
      toast.error(i18n.t("chat.historyOpenFailed"))
    }
  }
}

export async function newChatSession() {
  const currentState = getChatState()

  // Already on a fresh unsaved empty session — do nothing
  if (
    currentState.messages.length === 0 &&
    currentState.hasHydratedActiveSession &&
    !readStoredSessionId()
  ) {
    return
  }

  if (activeSessionIdRef) {
    if (currentState.messages.length > 0) {
      sessionMessagesMap.set(activeSessionIdRef, syncActiveBranches(currentState.messages))
    }
    sessionTypingMap.set(activeSessionIdRef, currentState.isTyping)
    const prevSocket = sessionSockets.get(activeSessionIdRef)
    if (prevSocket && !currentState.isTyping) {
      invalidateSocket(prevSocket)
      sessionSockets.delete(activeSessionIdRef)
    }
  }

  const newId = generateSessionId()
  activeSessionIdRef = newId
  clearStoredSessionId()
  updateChatStore({
    activeSessionId: newId,
    messages: [],
    isTyping: false,
    hasHydratedActiveSession: true,
    contextUsage: undefined,
  })

  if (store.get(gatewayAtom).status === "running") {
    shouldMaintainConnection = true
    connectSessionSocket(newId)
  }
}

export async function startTemporaryChatSession() {
  const currentState = getChatState()
  if (activeSessionIdRef) {
    sessionTypingMap.set(activeSessionIdRef, currentState.isTyping)
  }

  const tempId = generateTemporarySessionId()
  setActiveSessionId(tempId)
  updateChatStore({
    messages: [],
    isTyping: false,
    hasHydratedActiveSession: true,
    contextUsage: undefined,
  })

  if (store.get(gatewayAtom).status === "running") {
    shouldMaintainConnection = true
    connectSessionSocket(tempId)
  }
  return tempId
}

export async function endTemporaryChatSession(tempSessionId?: string) {
  const targetId = tempSessionId || activeSessionIdRef
  if (
    targetId &&
    (targetId.startsWith("temp-") || targetId.startsWith("temporary-"))
  ) {
    try {
      await deleteSession(targetId)
    } catch {
      // Ignore if session was not written on server
    }
  }

  const newId = generateSessionId()
  setActiveSessionId(newId)
  updateChatStore({
    messages: [],
    isTyping: false,
    hasHydratedActiveSession: true,
    contextUsage: undefined,
  })

  if (store.get(gatewayAtom).status === "running") {
    shouldMaintainConnection = true
    connectSessionSocket(newId)
  }
}


// Sync active session history directly from backend
export async function syncActiveSessionFromBackend(targetSessionId?: string) {
  const sessionId = targetSessionId || activeSessionIdRef
  if (!sessionId || sessionId.startsWith("temp-")) return
  try {
    const currentState = getChatState()
    if (currentState.activeSessionId !== sessionId || currentState.isTyping) {
      return
    }

    const historyMessages = await loadSessionMessages(sessionId)
    if (!historyMessages || historyMessages.length === 0) {
      return
    }

    const reconstructed = reconstructBranchesFromHistory(historyMessages)
    const hasHistoryBranches = reconstructed.some((m) => m.branches && m.branches.length > 0)
    const hasClientBranches = currentState.messages.some((m) => m.branches && m.branches.length > 0)

    let nextMessages = reconstructed
    if (!hasHistoryBranches && hasClientBranches && currentState.messages.length > 0) {
      nextMessages = reconstructed.map((recMsg) => {
        if (recMsg.role === "user") {
          const clientMatch = currentState.messages.find(
            (cm) => cm.role === "user" && (cm.id === recMsg.id || cm.content.trim() === recMsg.content.trim()),
          )
          if (clientMatch?.branches && clientMatch.branches.length > 0) {
            return {
              ...recMsg,
              branches: clientMatch.branches,
              activeBranchIndex: clientMatch.activeBranchIndex,
              branchType: clientMatch.branchType,
            }
          }
        }
        return recMsg
      })
    }

    sessionMessagesMap.set(sessionId, nextMessages)
    updateChatStore({
      messages: nextMessages,
      isTyping: false,
    })
    sessionTypingMap.set(sessionId, false)
  } catch {
    // Ignore if session not yet created on backend
  }
}

let activeSessionPoller: number | null = null
let appForegroundHandler: (() => void) | null = null

export let lastActiveSessionMessageCount = 0

export function initializeChatStore() {
  if (initialized) {
    return
  }

  initialized = true
  activeSessionIdRef = getChatState().activeSessionId
  let lastGatewayStatus: GatewayState | null = null

  const syncConnectionWithGateway = (force: boolean = false) => {
    const gatewayStatus = store.get(gatewayAtom).status
    if (!force && gatewayStatus === lastGatewayStatus) {
      return
    }
    lastGatewayStatus = gatewayStatus

    if (gatewayStatus === "running") {
      shouldMaintainConnection = true
      if (needsActiveSessionHydration()) {
        return
      }
      void connectChat()
      return
    }

    if (gatewayStatus === "stopped" || gatewayStatus === "error") {
      disconnectChatInternal({ clearDesiredConnection: true })
    }
  }

  unsubscribeGateway = store.sub(gatewayAtom, syncConnectionWithGateway)

  // Resync on mobile tab resume or window focus
  appForegroundHandler = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return
    }
    if (store.get(gatewayAtom).status === "running") {
      const activeSock = sessionSockets.get(activeSessionIdRef)
      if (!activeSock || activeSock.readyState !== WebSocket.OPEN) {
        shouldMaintainConnection = true
        connectSessionSocket(activeSessionIdRef)
      }
      void syncActiveSessionFromBackend(activeSessionIdRef)
    }
  }

  window.addEventListener("focus", appForegroundHandler)
  window.addEventListener("pageshow", appForegroundHandler)
  document.addEventListener("visibilitychange", appForegroundHandler)

  if (!readStoredSessionId()) {
    updateChatStore({ hasHydratedActiveSession: true })
    syncConnectionWithGateway(true)
    return
  }

  void hydrateActiveSession().finally(() => {
    if (!initialized) {
      return
    }
    syncConnectionWithGateway(true)
  })
}

export function teardownChatStore() {
  if (appForegroundHandler) {
    window.removeEventListener("focus", appForegroundHandler)
    window.removeEventListener("pageshow", appForegroundHandler)
    document.removeEventListener("visibilitychange", appForegroundHandler)
    appForegroundHandler = null
  }
  if (activeSessionPoller !== null) {
    window.clearInterval(activeSessionPoller)
    activeSessionPoller = null
  }
  unsubscribeGateway?.()
  unsubscribeGateway = null
  initialized = false
  disconnectChat()
}
