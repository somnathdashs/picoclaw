import type { ChatMessage } from "@/store/chat"

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

// Reconstruct branch structures from backend history (in-memory only, no localStorage)
export function reconstructBranchesFromHistory(
  historyMessages: ChatMessage[],
): ChatMessage[] {
  if (historyMessages.length === 0) return []

  interface Turn {
    user: ChatMessage
    assistantMsgs: ChatMessage[]
  }
  const turns: Turn[] = []
  let currentTurn: Turn | null = null

  for (const msg of historyMessages) {
    if (msg.role === "user") {
      if (currentTurn) turns.push(currentTurn)
      currentTurn = { user: msg, assistantMsgs: [] }
    } else if (currentTurn) {
      currentTurn.assistantMsgs.push(msg)
    } else {
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
  if (currentTurn) turns.push(currentTurn)

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
      activeBranchIndex: branchSnapshots.length - 1,
    })
    i = j
  }

  const finalMessages: ChatMessage[] = []
  for (const group of groupedTurns) {
    const { branches, activeBranchIndex: activeIdx } = group
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
    if (activeBranch) finalMessages.push(...activeBranch)
  }

  return finalMessages
}
