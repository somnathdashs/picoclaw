import { getDefaultStore } from "jotai"
import { toast } from "sonner"

import { deleteSession } from "@/api/sessions"
import { loadSessionMessages } from "@/features/chat/history"
import {
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
      } else {
        const cached = sessionMessagesMap.get(sessionId) ?? []
        const wasTyping = sessionTypingMap.get(sessionId) ?? true
        const result = reducePicoMessage(cached, wasTyping, message)
        sessionMessagesMap.set(sessionId, result.messages)
        sessionTypingMap.set(sessionId, result.isTyping)
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
}

function attachFileTagsToContent(
  content: string,
  attachments: readonly ChatAttachment[] = [],
): string {
  const normalized = content.trim()
  const fileAttachments = attachments.filter(
    (att) => att.type === "file" && (att.filename || att.url),
  )
  if (fileAttachments.length === 0) {
    return normalized
  }

  const fileTags = fileAttachments
    .map((f) => {
      const filePath = f.url || f.filename
      return f.filename && f.url && f.url !== f.filename
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
  recordLocalSession(sessionId, userText)

  try {
    const outgoingContent = attachFileTagsToContent(normalizedContent, fileAttachments)

    const payload: Record<string, unknown> = {
      content: outgoingContent,
      media: imageAttachments.map((attachment) => attachment.url),
      branch_history: branchHistory,
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

  const idx = state.messages.findIndex((m) => m.id === turnRootId)
  if (idx < 0) return false

  const rootMsg = state.messages[idx]
  if (!rootMsg.branches || rootMsg.branches.length === 0) return false
  if (
    targetBranchIndex < 0 ||
    targetBranchIndex >= rootMsg.branches.length
  ) {
    return false
  }

  const branches = rootMsg.branches
  const currentBranchIdx = rootMsg.activeBranchIndex ?? 0

  const currentSnapshot = state.messages.slice(idx)
  if (currentSnapshot.length > 0) {
    currentSnapshot[0].activeBranchIndex = currentBranchIdx
    currentSnapshot[0].branches = branches
  }
  branches[currentBranchIdx] = currentSnapshot

  if (currentBranchIdx === targetBranchIndex) return true

  const targetBranch = branches[targetBranchIndex]
  if (!targetBranch || targetBranch.length === 0) return false

  targetBranch[0].branches = branches
  targetBranch[0].activeBranchIndex = targetBranchIndex

  for (let b = 0; b < branches.length; b++) {
    if (branches[b][0]) {
      branches[b][0].branches = branches
      branches[b][0].activeBranchIndex = b
      if (rootMsg.branchType) {
        branches[b][0].branchType = rootMsg.branchType
      }
    }
  }

  const nextMessages = [...state.messages.slice(0, idx), ...targetBranch]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({ messages: nextMessages })
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

  const branches: ChatMessage[][] = userMsg.branches
    ? [...userMsg.branches]
    : []
  if (branches.length === 0) {
    if (currentSnapshot.length > 0) {
      currentSnapshot[0].activeBranchIndex = 0
      currentSnapshot[0].branchType = "regeneration"
    }
    branches.push(currentSnapshot)
  } else {
    const curIdx = userMsg.activeBranchIndex ?? 0
    if (currentSnapshot.length > 0) {
      currentSnapshot[0].activeBranchIndex = curIdx
      currentSnapshot[0].branchType = "regeneration"
    }
    branches[curIdx] = currentSnapshot
  }

  const newBranchIndex = branches.length
  const newId = `msg-${++msgIdCounter}-${Date.now()}`
  const newMsg = {
    ...userMsg,
    id: newId,
    timestamp: Date.now(),
    branches,
    activeBranchIndex: newBranchIndex,
    branchType: "regeneration" as const,
  }

  branches.push([newMsg])
  for (let b = 0; b < branches.length; b++) {
    if (branches[b][0]) {
      branches[b][0].branches = branches
      branches[b][0].activeBranchIndex = b
      branches[b][0].branchType = "regeneration"
    }
  }

  const nextMessages = [...state.messages.slice(0, userIdx), newMsg]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })

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

  const branches: ChatMessage[][] = userMsg.branches
    ? [...userMsg.branches]
    : []
  const curIdx = userMsg.activeBranchIndex ?? 0

  if (branches.length === 0) {
    if (currentSnapshot.length > 0) {
      currentSnapshot[0].activeBranchIndex = 0
      currentSnapshot[0].branchType = "edit"
    }
    branches.push(currentSnapshot)
  } else {
    if (currentSnapshot.length > 0) {
      currentSnapshot[0].activeBranchIndex = curIdx
      currentSnapshot[0].branchType = "edit"
    }
    branches[curIdx] = currentSnapshot
  }

  const newBranchIndex = branches.length
  const newId = `msg-${++msgIdCounter}-${Date.now()}`
  const newMsg = {
    ...userMsg,
    id: newId,
    content: text,
    timestamp: Date.now(),
    branches,
    activeBranchIndex: newBranchIndex,
    branchType: "edit" as const,
  }

  branches.push([newMsg])
  for (let b = 0; b < branches.length; b++) {
    if (branches[b][0]) {
      branches[b][0].branches = branches
      branches[b][0].activeBranchIndex = b
      branches[b][0].branchType = "edit"
    }
  }

  const nextMessages = [...state.messages.slice(0, userIdx), newMsg]
  sessionMessagesMap.set(state.activeSessionId, nextMessages)
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })
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
    let targetMessages: ChatMessage[] = []
    if (sessionMessagesMap.has(sessionId)) {
      targetMessages = sessionMessagesMap.get(sessionId)!
    } else {
      const historyMessages = await loadSessionMessages(sessionId)
      targetMessages = reconstructBranchesFromHistory(historyMessages)
      sessionMessagesMap.set(sessionId, targetMessages)
    }
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


let activeSessionPoller: number | null = null

// Removed: syncActiveSessionIfUpdated poller — backend is the source of truth.
// Messages load fresh from the API on every session switch.
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
  if (activeSessionPoller !== null) {
    window.clearInterval(activeSessionPoller)
    activeSessionPoller = null
  }
  unsubscribeGateway?.()
  unsubscribeGateway = null
  initialized = false
  disconnectChat()
}
