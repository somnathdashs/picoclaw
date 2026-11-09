import type { ChatMessage } from "@/store/chat"
import type { SessionBranchTurn } from "@/api/sessions"

// Extract branch structures to save to gateway
export function extractBranchTurns(messages: ChatMessage[]): SessionBranchTurn[] {
  const turns: SessionBranchTurn[] = []
  for (const m of messages) {
    if (m.role === "user" && m.branches && m.branches.length > 0) {
      turns.push({
        root_id: m.id,
        active_branch_index: m.activeBranchIndex ?? 0,
        branch_type: m.branchType ?? "regeneration",
        branches: m.branches.map((b) =>
          b.map((msg) => ({
            id: msg.id,
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
            kind: msg.kind,
            model_name: msg.modelName,
            created_at:
              typeof msg.timestamp === "number"
                ? new Date(msg.timestamp).toISOString()
                : String(msg.timestamp),
            attachments: (msg.attachments ?? []).map((att) => ({
              type: att.type,
              url: att.url,
              filename: att.filename,
              content_type: att.contentType,
            })),
          })),
        ),
      })
    }
  }
  return turns
}

// Sync active branch snapshots into root branches array
export function syncActiveBranches(messages: ChatMessage[]): ChatMessage[] {
  const result = [...messages]
  for (let i = 0; i < result.length; i++) {
    const m = result[i]
    if (m.branches && m.branches.length > 0) {
      const curIdx = Math.max(
        0,
        Math.min(m.activeBranchIndex ?? 0, m.branches.length - 1),
      )
      const currentSnapshot = result.slice(i)
      // Clone branches array to avoid mutating the shared reference
      const updatedBranches = [...m.branches]
      updatedBranches[curIdx] = currentSnapshot

      for (let b = 0; b < updatedBranches.length; b++) {
        if (updatedBranches[b]?.[0]) {
          // Clone the root message of each branch before mutating
          updatedBranches[b] = [
            {
              ...updatedBranches[b][0],
              branches: updatedBranches,
              activeBranchIndex: b,
              ...(m.branchType ? { branchType: m.branchType } : {}),
            },
            ...updatedBranches[b].slice(1),
          ]
        }
      }

      // Replace the message in result with an updated clone
      result[i] = { ...m, branches: updatedBranches, activeBranchIndex: curIdx }
    }
  }
  return result
}

// Format chat messages along the active branch for backend prompt history
export function formatBranchHistory(messages: ChatMessage[]) {
  return messages.map((m) => {
    const media = (m.attachments ?? [])
      .filter((att) => att.type === "image" && att.url)
      .map((att) => att.url)

    const attachments = (m.attachments ?? []).map((att) => ({
      type: att.type,
      url: att.url,
      filename: att.filename,
      content_type: att.contentType,
      path: att.path,
      ref: att.path || att.url,
    }))

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
      attachments: attachments.length > 0 ? attachments : undefined,
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

  // If gateway already provided branches, use them directly
  if (historyMessages.some((m) => m.branches && m.branches.length > 0)) {
    return historyMessages
  }

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

    const updatedBranches: ChatMessage[][] = []
    for (let b = 0; b < branches.length; b++) {
      if (branches[b]?.[0]) {
        updatedBranches.push([
          {
            ...branches[b][0],
            branches: updatedBranches,
            activeBranchIndex: b,
            branchType,
          },
          ...branches[b].slice(1),
        ])
      } else {
        updatedBranches.push(branches[b] ?? [])
      }
    }

    const activeBranch = updatedBranches[activeIdx] ?? updatedBranches[0]
    if (activeBranch) finalMessages.push(...activeBranch)
  }

  return finalMessages
}
