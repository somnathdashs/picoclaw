import type { ChatMessage } from "@/store/chat"

const BRANCHES_STORAGE_PREFIX = "picoclaw_branches_v1_"

// Sync active branch snapshots into root branches array
export function syncActiveBranches(messages: ChatMessage[]): ChatMessage[] {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.branches && m.branches.length > 0) {
      const curIdx = Math.max(
        0,
        Math.min(m.activeBranchIndex ?? 0, m.branches.length - 1),
      )
      const currentSnapshot = messages.slice(i)
      m.branches[curIdx] = currentSnapshot

      for (let b = 0; b < m.branches.length; b++) {
        if (m.branches[b]?.[0]) {
          m.branches[b][0].branches = m.branches
          m.branches[b][0].activeBranchIndex = b
          if (m.branchType) {
            m.branches[b][0].branchType = m.branchType
          }
        }
      }
    }
  }
  return messages
}

// Format chat messages along the active branch for backend prompt history
export function formatBranchHistory(messages: ChatMessage[]) {
  return messages.map((m) => {
    const media = (m.attachments ?? [])
      .filter((att) => att.type === "image" && att.url)
      .map((att) => att.url)

    const toolCalls = (m.toolCalls ?? []).map((tc) => ({
      id: tc.id ?? "",
      type: tc.type ?? "function",
      function: {
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "",
      },
    }))

    return {
      role: m.role,
      content: m.content,
      model_name: m.modelName,
      media: media.length > 0 ? media : undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  })
}

// Strip circular branches references for safe JSON serialization
function sanitizeForStorage(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (!m.branches || m.branches.length === 0) {
      const { branches, ...rest } = m
      return rest
    }
    const cleanBranches = m.branches.map((branchList) =>
      branchList.map((msg) => {
        const { branches, ...rest } = msg
        return rest
      }),
    )
    return {
      ...m,
      branches: cleanBranches,
      activeBranchIndex: m.activeBranchIndex ?? 0,
      branchType: m.branchType,
    }
  })
}

// Restore circular references after deserializing from storage
function restoreFromStorage(list: unknown[]): ChatMessage[] | null {
  if (!Array.isArray(list)) return null
  const messages = list as ChatMessage[]
  for (const msg of messages) {
    if (
      msg.branches &&
      Array.isArray(msg.branches) &&
      msg.branches.length > 0
    ) {
      for (let b = 0; b < msg.branches.length; b++) {
        if (msg.branches[b]?.[0]) {
          msg.branches[b][0].branches = msg.branches
          msg.branches[b][0].activeBranchIndex = b
        }
      }
    }
  }
  return messages
}

export function saveSessionBranches(
  sessionId: string,
  messages: ChatMessage[],
): void {
  if (!sessionId) return
  try {
    const synced = syncActiveBranches([...messages])
    const data = sanitizeForStorage(synced)
    localStorage.setItem(
      `${BRANCHES_STORAGE_PREFIX}${sessionId}`,
      JSON.stringify(data),
    )
  } catch (err) {
    console.warn("Failed to persist branch state:", err)
  }
}

export function loadSessionBranches(sessionId: string): ChatMessage[] | null {
  if (!sessionId) return null
  try {
    const raw = localStorage.getItem(`${BRANCHES_STORAGE_PREFIX}${sessionId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return restoreFromStorage(parsed)
  } catch {
    return null
  }
}

// Check if two user turns represent the same prompt for branching
function isSameUserPrompt(a?: ChatMessage, b?: ChatMessage): boolean {
  if (!a || !b) return false
  if (a.role !== "user" || b.role !== "user") return false
  if (a.content.trim() !== b.content.trim()) return false
  const attA = a.attachments ?? []
  const attB = b.attachments ?? []
  if (attA.length !== attB.length) return false
  return attA.every((att, idx) => att.url === attB[idx]?.url)
}

// Reconstruct branch structures from backend history and stored state
export function reconstructBranchesFromHistory(
  historyMessages: ChatMessage[],
  savedBranches?: ChatMessage[] | null,
): ChatMessage[] {
  if (historyMessages.length === 0) return []

  // 1. Group linear history messages into user-led turns
  interface Turn {
    user: ChatMessage
    assistantMsgs: ChatMessage[]
  }
  const turns: Turn[] = []
  let currentTurn: Turn | null = null

  for (const msg of historyMessages) {
    if (msg.role === "user") {
      if (currentTurn) {
        turns.push(currentTurn)
      }
      currentTurn = { user: msg, assistantMsgs: [] }
    } else if (currentTurn) {
      currentTurn.assistantMsgs.push(msg)
    } else {
      // Leading assistant messages without user
      turns.push({
        user: {
          id: `virtual-user-${msg.id}`,
          role: "user",
          content: "",
          timestamp: msg.timestamp,
        },
        assistantMsgs: [msg],
      })
    }
  }
  if (currentTurn) {
    turns.push(currentTurn)
  }

  // 2. Identify consecutive turns with identical user input as branches
  interface BranchedGroup {
    branches: ChatMessage[][]
    activeBranchIndex: number
  }
  const groupedTurns: BranchedGroup[] = []
  let i = 0

  while (i < turns.length) {
    const baseTurn = turns[i]
    const branchSnapshots: ChatMessage[][] = [
      [baseTurn.user, ...baseTurn.assistantMsgs],
    ]

    let j = i + 1
    while (j < turns.length && isSameUserPrompt(baseTurn.user, turns[j].user)) {
      branchSnapshots.push([turns[j].user, ...turns[j].assistantMsgs])
      j++
    }

    groupedTurns.push({
      branches: branchSnapshots,
      activeBranchIndex: branchSnapshots.length - 1, // Default to newest
    })
    i = j
  }

  // 3. Match with savedBranches in localStorage if available
  if (savedBranches && savedBranches.length > 0) {
    const savedUserTurns = savedBranches.filter((m) => m.role === "user")

    for (let turnIdx = 0; turnIdx < groupedTurns.length; turnIdx++) {
      const group = groupedTurns[turnIdx]
      const currentTurnUser = group.branches[0]?.[0]
      if (!currentTurnUser) continue

      const savedUser =
        savedUserTurns.find((s) => {
          if (isSameUserPrompt(s, currentTurnUser)) return true
          if (s.branches?.some((b) => isSameUserPrompt(b[0], currentTurnUser)))
            return true
          return false
        }) || savedUserTurns[turnIdx]

      if (savedUser?.branches && savedUser.branches.length > 0) {
        group.branches = savedUser.branches
        if (
          savedUser.activeBranchIndex !== undefined &&
          savedUser.activeBranchIndex >= 0 &&
          savedUser.activeBranchIndex < savedUser.branches.length
        ) {
          group.activeBranchIndex = savedUser.activeBranchIndex
        }
      } else if (
        savedUser?.activeBranchIndex !== undefined &&
        savedUser.activeBranchIndex >= 0 &&
        savedUser.activeBranchIndex < group.branches.length
      ) {
        group.activeBranchIndex = savedUser.activeBranchIndex
      }
    }
  }

  // 4. Assemble final message stream with linked branches
  const finalMessages: ChatMessage[] = []
  for (const group of groupedTurns) {
    const branches = group.branches
    const activeIdx = group.activeBranchIndex

    const branchType =
      branches[0]?.[0]?.branchType ??
      (branches.length > 1 &&
      branches[0]?.[0]?.content.trim() !== branches[1]?.[0]?.content.trim()
        ? "edit"
        : "regeneration")

    for (let b = 0; b < branches.length; b++) {
      if (branches[b]?.[0]) {
        branches[b][0].branches = branches
        branches[b][0].activeBranchIndex = b
        branches[b][0].branchType = branchType
      }
    }

    const activeBranch = branches[activeIdx] ?? branches[0]
    if (activeBranch) {
      finalMessages.push(...activeBranch)
    }
  }

  return finalMessages
}
