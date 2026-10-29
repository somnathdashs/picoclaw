import { getDefaultStore } from "jotai"
import { toast } from "sonner"

import { deleteSession, getSessionHistory } from "@/api/sessions"
import {
  loadSessionMessages,
  mergeHistoryMessages,
} from "@/features/chat/history"
import {
  formatBranchHistory,
  loadSessionBranches,
  reconstructBranchesFromHistory,
  saveSessionBranches,
} from "@/features/chat/branches"
import { type PicoMessage, handlePicoMessage } from "@/features/chat/protocol"
import {
  clearStoredSessionId,
  generateSessionId,
  generateTemporarySessionId,
  readStoredSessionId,
} from "@/features/chat/state"
import { invalidateSocket, isCurrentSocket } from "@/features/chat/websocket"
import i18n from "@/i18n"
import {
  type ChatAttachment,
  type ChatMessage,
  getChatState,
  updateChatStore,
} from "@/store/chat"
import { type GatewayState, gatewayAtom } from "@/store/gateway"

const store = getDefaultStore()

let wsRef: WebSocket | null = null
let isConnecting = false
let msgIdCounter = 0
let activeSessionIdRef = getChatState().activeSessionId
let initialized = false
let unsubscribeGateway: (() => void) | null = null
let hydratePromise: Promise<void> | null = null
let connectionGeneration = 0
let reconnectTimer: number | null = null
let reconnectAttempts = 0
let shouldMaintainConnection = false

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function shouldReconnectFor(generation: number, sessionId: string): boolean {
  return (
    shouldMaintainConnection &&
    generation === connectionGeneration &&
    sessionId === activeSessionIdRef &&
    store.get(gatewayAtom).status === "running"
  )
}

function scheduleReconnect(generation: number, sessionId: string) {
  if (!shouldReconnectFor(generation, sessionId) || reconnectTimer !== null) {
    return
  }

  const delay = Math.min(1000 * 2 ** reconnectAttempts, 5000)
  reconnectAttempts += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    if (!shouldReconnectFor(generation, sessionId)) {
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

function disconnectChatInternal({
  clearDesiredConnection,
}: {
  clearDesiredConnection: boolean
}) {
  connectionGeneration += 1
  clearReconnectTimer()

  if (clearDesiredConnection) {
    shouldMaintainConnection = false
  }

  const socket = wsRef
  wsRef = null
  isConnecting = false

  invalidateSocket(socket)

  updateChatStore({
    connectionState: "disconnected",
    isTyping: false,
  })
}

export async function connectChat() {
  if (
    store.get(gatewayAtom).status !== "running" ||
    needsActiveSessionHydration()
  ) {
    return
  }

  if (
    isConnecting ||
    (wsRef &&
      (wsRef.readyState === WebSocket.OPEN ||
        wsRef.readyState === WebSocket.CONNECTING))
  ) {
    return
  }

  const generation = connectionGeneration + 1
  connectionGeneration = generation
  isConnecting = true
  clearReconnectTimer()
  updateChatStore({ connectionState: "connecting" })

  try {
    const sessionId = activeSessionIdRef

    if (generation !== connectionGeneration) {
      isConnecting = false
      return
    }

    const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${wsScheme}//${window.location.host}/pico/ws`
    const url = `${wsUrl}?session_id=${encodeURIComponent(sessionId)}`
    const socket = new WebSocket(url)

    if (generation !== connectionGeneration) {
      isConnecting = false
      invalidateSocket(socket)
      return
    }

    socket.onopen = () => {
      if (
        !isCurrentSocket({
          socket,
          currentSocket: wsRef,
          generation,
          currentGeneration: connectionGeneration,
          sessionId,
          currentSessionId: activeSessionIdRef,
        })
      ) {
        return
      }
      updateChatStore({ connectionState: "connected" })
      isConnecting = false
      reconnectAttempts = 0
    }

    socket.onmessage = (event) => {
      if (
        !isCurrentSocket({
          socket,
          currentSocket: wsRef,
          generation,
          currentGeneration: connectionGeneration,
          sessionId,
          currentSessionId: activeSessionIdRef,
        })
      ) {
        return
      }

      try {
        const message = JSON.parse(event.data) as PicoMessage
        handlePicoMessage(message, sessionId)
      } catch {
        console.warn("Non-JSON message from pico:", event.data)
      }
    }

    socket.onclose = () => {
      if (
        !isCurrentSocket({
          socket,
          currentSocket: wsRef,
          generation,
          currentGeneration: connectionGeneration,
          sessionId,
          currentSessionId: activeSessionIdRef,
        })
      ) {
        return
      }
      wsRef = null
      isConnecting = false
      updateChatStore({
        connectionState: "disconnected",
        isTyping: false,
      })
      scheduleReconnect(generation, sessionId)
    }

    socket.onerror = () => {
      if (
        !isCurrentSocket({
          socket,
          currentSocket: wsRef,
          generation,
          currentGeneration: connectionGeneration,
          sessionId,
          currentSessionId: activeSessionIdRef,
        })
      ) {
        return
      }
      isConnecting = false
      updateChatStore({ connectionState: "error" })
      scheduleReconnect(generation, sessionId)
    }

    wsRef = socket
  } catch (error) {
    if (generation !== connectionGeneration) {
      isConnecting = false
      return
    }
    console.error("Failed to connect to pico:", error)
    updateChatStore({ connectionState: "error" })
    isConnecting = false
    scheduleReconnect(generation, activeSessionIdRef)
  }
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
      if (currentState.activeSessionId !== storedSessionId) {
        return
      }

      const savedBranches = loadSessionBranches(storedSessionId)
      const reconstructed = reconstructBranchesFromHistory(
        historyMessages,
        savedBranches,
      )

      if (currentState.messages.length > 0) {
        const merged = mergeHistoryMessages(
          reconstructed,
          currentState.messages,
        )
        const finalMessages = reconstructBranchesFromHistory(
          merged,
          savedBranches,
        )
        updateChatStore({
          messages: finalMessages,
          hasHydratedActiveSession: true,
        })
        saveSessionBranches(storedSessionId, finalMessages)
        return
      }

      updateChatStore({
        messages: reconstructed,
        isTyping: false,
        hasHydratedActiveSession: true,
      })
      saveSessionBranches(storedSessionId, reconstructed)
    })
    .catch((error) => {
      console.error("Failed to restore last session history:", error)

      const currentState = getChatState()
      if (currentState.activeSessionId !== storedSessionId) {
        return
      }

      if (currentState.messages.length > 0) {
        updateChatStore({ hasHydratedActiveSession: true })
        return
      }

      clearStoredSessionId()
      updateChatStore({
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

export function sendChatMessage({
  content,
  displayContent,
  attachments = [],
}: SendChatMessageInput) {
  const state = getChatState()

  if (!wsRef || wsRef.readyState !== WebSocket.OPEN) {
    if (store.get(gatewayAtom).status === "running") {
      void connectChat()
    }
    return false
  }

  const normalizedContent = content.trim()
  const normalizedAttachments = attachments
    .filter((attachment) => attachment.type === "image" && attachment.url)
    .map((attachment) => ({ ...attachment }))

  if (!normalizedContent && normalizedAttachments.length === 0) {
    return false
  }

  const socket = wsRef
  const id = `msg-${++msgIdCounter}-${Date.now()}`
  const branchHistory = formatBranchHistory(state.messages)

  updateChatStore((prev) => ({
    messages: [
      ...prev.messages,
      {
        id,
        role: "user",
        content: displayContent?.trim() || normalizedContent,
        attachments:
          normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
        timestamp: Date.now(),
      },
    ],
    isTyping: true,
  }))

  try {
    const payload: Record<string, unknown> = {
      content: normalizedContent,
      media: normalizedAttachments.map((attachment) => attachment.url),
      branch_history: branchHistory,
    }

    socket.send(
      JSON.stringify({
        type: "message.send",
        id,
        session_id: state.activeSessionId,
        payload,
      }),
    )
    return true
  } catch (error) {
    console.error("Failed to send pico message:", error)
    updateChatStore((prev) => ({
      messages: prev.messages.filter((message) => message.id !== id),
      isTyping: false,
    }))
  }
}

export function stopAgentTurn() {
  const state = getChatState()
  if (wsRef && wsRef.readyState === WebSocket.OPEN) {
    try {
      wsRef.send(
        JSON.stringify({
          type: "message.send",
          id: `stop-${Date.now()}`,
          session_id: state.activeSessionId,
          payload: { content: "/stop" },
        }),
      )
    } catch (err) {
      console.warn("Failed to send stop command:", err)
    }
  }

  updateChatStore((prev) => ({
    messages: [
      ...prev.messages,
      {
        id: `interrupt-${Date.now()}`,
        role: "assistant",
        content: "User interrupted.",
        timestamp: Date.now(),
      },
    ],
    isTyping: false,
  }))
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
  updateChatStore({
    messages: nextMessages,
  })
  if (state.activeSessionId) {
    saveSessionBranches(state.activeSessionId, nextMessages)
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
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })
  if (state.activeSessionId) {
    saveSessionBranches(state.activeSessionId, nextMessages)
  }

  if (!wsRef || wsRef.readyState !== WebSocket.OPEN) {
    updateChatStore({ isTyping: false })
    return false
  }

  try {
    const payload: Record<string, unknown> = {
      content: newMsg.content,
      media: (newMsg.attachments || [])
        .filter((att) => att.type === "image" && att.url)
        .map((att) => att.url),
      branch_history: formatBranchHistory(state.messages.slice(0, userIdx)),
    }

    wsRef.send(
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

  // If agent is active, send /stop to abort any ongoing work on the backend
  if (state.isTyping && wsRef && wsRef.readyState === WebSocket.OPEN) {
    try {
      wsRef.send(
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
  updateChatStore({
    messages: nextMessages,
    isTyping: true,
  })
  if (state.activeSessionId) {
    saveSessionBranches(state.activeSessionId, nextMessages)
  }

  if (!wsRef || wsRef.readyState !== WebSocket.OPEN) {
    updateChatStore({ isTyping: false })
    return false
  }

  try {
    const payload: Record<string, unknown> = {
      content: text,
      media: (newMsg.attachments || [])
        .filter((att) => att.type === "image" && att.url)
        .map((att) => att.url),
      branch_history: formatBranchHistory(state.messages.slice(0, userIdx)),
    }

    wsRef.send(
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
    return false
  }
}

export async function switchChatSession(sessionId: string) {
  if (sessionId === activeSessionIdRef) {
    return
  }

  try {
    const historyMessages = await loadSessionMessages(sessionId)
    const savedBranches = loadSessionBranches(sessionId)
    const finalMessages = reconstructBranchesFromHistory(
      historyMessages,
      savedBranches,
    )

    disconnectChatInternal({ clearDesiredConnection: false })
    setActiveSessionId(sessionId)
    updateChatStore({
      messages: finalMessages,
      isTyping: false,
      hasHydratedActiveSession: true,
      contextUsage: undefined,
    })

    lastActiveSessionMessageCount = finalMessages.length
    if (store.get(gatewayAtom).status === "running") {
      shouldMaintainConnection = true
      await connectChat()
    }
  } catch (error) {
    console.error("Failed to load session history:", error)
    toast.error(i18n.t("chat.historyOpenFailed"))
  }
}

export async function newChatSession() {
  if (getChatState().messages.length === 0) {
    return
  }

  disconnectChatInternal({ clearDesiredConnection: false })
  setActiveSessionId(generateSessionId())
  updateChatStore({
    messages: [],
    isTyping: false,
    hasHydratedActiveSession: true,
    contextUsage: undefined,
  })

  if (store.get(gatewayAtom).status === "running") {
    shouldMaintainConnection = true
    await connectChat()
  }
}

export async function startTemporaryChatSession() {
  disconnectChatInternal({ clearDesiredConnection: false })
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
    await connectChat()
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

  disconnectChatInternal({ clearDesiredConnection: false })
  setActiveSessionId(generateSessionId())
  updateChatStore({
    messages: [],
    isTyping: false,
    hasHydratedActiveSession: true,
    contextUsage: undefined,
  })

  if (store.get(gatewayAtom).status === "running") {
    shouldMaintainConnection = true
    await connectChat()
  }
}

let activeSessionPoller: number | null = null
let isSyncingActiveSession = false
export let lastActiveSessionMessageCount = 0

async function syncActiveSessionIfUpdated() {
  const currentSessionId = activeSessionIdRef
  if (
    !currentSessionId ||
    currentSessionId.startsWith("temp-") ||
    currentSessionId.startsWith("temporary-") ||
    isSyncingActiveSession
  ) {
    return
  }

  const state = getChatState()
  if (state.isTyping) {
    return
  }

  isSyncingActiveSession = true
  try {
    const detail = await getSessionHistory(currentSessionId)
    if (activeSessionIdRef !== currentSessionId) return

    const currentMessages = getChatState().messages
    const hasCountChange = detail.messages.length !== currentMessages.length
    const hasContentChange =
      detail.messages.length > 0 &&
      currentMessages.length > 0 &&
      detail.messages[detail.messages.length - 1].content !==
        currentMessages[currentMessages.length - 1].content

    if (hasCountChange || hasContentChange) {
      lastActiveSessionMessageCount = detail.messages.length
      const historyMessages = await loadSessionMessages(currentSessionId)
      if (activeSessionIdRef !== currentSessionId) return

      const savedBranches = loadSessionBranches(currentSessionId)
      const finalMessages = reconstructBranchesFromHistory(
        historyMessages,
        savedBranches,
      )

      updateChatStore({
        messages: finalMessages,
      })
    }
  } catch {
    // Session not yet saved or transient network error
  } finally {
    isSyncingActiveSession = false
  }
}

export function initializeChatStore() {
  if (initialized) {
    return
  }

  initialized = true
  activeSessionIdRef = getChatState().activeSessionId
  let lastGatewayStatus: GatewayState | null = null

  if (typeof window !== "undefined") {
    if (activeSessionPoller !== null) {
      window.clearInterval(activeSessionPoller)
    }
    activeSessionPoller = window.setInterval(() => {
      void syncActiveSessionIfUpdated()
    }, 1500)

    window.addEventListener("focus", () => void syncActiveSessionIfUpdated())
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void syncActiveSessionIfUpdated()
      }
    })
  }

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
