import { getSessionHistory, type SessionDetailMessage } from "@/api/sessions"
import { buildWorkspaceFileUrl } from "@/api/workspace"
import { normalizeUnixTimestamp } from "@/features/chat/state"
import {
  parseToolCallsValue,
  toolCallsSignature,
} from "@/features/chat/tool-calls"
import type { ChatAttachment, ChatMessage } from "@/store/chat"

const uuidPrefixRegex = /^[0-9a-fA-F-]{8,37}_/

export function cleanAttachmentFilename(filename?: string): string {
  if (!filename) return ""
  const base = filename.split(/[/\\]/).pop() || filename
  return base.replace(uuidPrefixRegex, "")
}

function toChatAttachments({
  media,
  attachments,
}: {
  media?: string[]
  attachments?: {
    type?: "image" | "audio" | "video" | "file"
    url?: string
    filename?: string
    content_type?: string
    path?: string
    size?: number
  }[]
}): ChatAttachment[] | undefined {
  const normalizedAttachments = attachments
    ?.filter((attachment) => attachment.url || attachment.path)
    .map(
      (attachment) => {
        const path = attachment.path
        const url = attachment.url || (path ? buildWorkspaceFileUrl(path) : "")
        const rawFilename = attachment.filename || (path ? path.split(/[/\\]/).pop() : "file") || "file"
        const filename = cleanAttachmentFilename(rawFilename)
        return {
          type: (attachment.type as "image" | "audio" | "video" | "file") ?? "file",
          url,
          filename,
          contentType: attachment.content_type,
          path,
          size: attachment.size,
        } satisfies ChatAttachment
      },
    )

  const legacyMediaAttachments = (media ?? [])
    .filter((item) => item.startsWith("data:image/"))
    .map((url) => ({ type: "image" as const, url }))

  const merged = [...(normalizedAttachments ?? []), ...legacyMediaAttachments]

  return merged.length > 0 ? merged : undefined
}

function mapBackendBranchMessages(
  branch: SessionDetailMessage[],
  indexOffset: number,
  fallbackTs: string,
): ChatMessage[] {
  return branch.map((m, idx) => ({
    id: m.id || `branch-msg-${indexOffset}-${idx}`,
    role: m.role,
    content: m.content || "",
    kind: m.role === "assistant" ? (m.kind ?? "normal") : undefined,
    modelName: m.model_name,
    toolCalls: m.role === "assistant" ? parseToolCallsValue(m.tool_calls) : undefined,
    attachments: toChatAttachments({ media: m.media, attachments: m.attachments }),
    timestamp: m.created_at ?? fallbackTs,
  }))
}

export async function loadSessionMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  const detail = await getSessionHistory(sessionId)
  return detail.messages.map((message, index) => {
    let content = message.content
    let attachments = toChatAttachments({
      media: message.media,
      attachments: message.attachments,
    })

    if (message.role === "user" && (!attachments || attachments.length === 0)) {
      const fileTagRegex = /(?:^|\s)(?:[^\s\r\n]+ )?\[(file|image):([^\]]+)\]/g
      const extracted: ChatAttachment[] = []
      let match: RegExpExecArray | null
      while ((match = fileTagRegex.exec(content)) !== null) {
        const tagType = match[1] === "image" ? ("image" as const) : ("file" as const)
        const filePath = match[2]
        const filename = cleanAttachmentFilename(filePath)
        extracted.push({
          type: tagType,
          filename,
          path: filePath,
          url: buildWorkspaceFileUrl(filePath),
        })
      }
      if (extracted.length > 0) {
        attachments = extracted
      }
    }

    content = content.replace(/(?:\r?\n)?[^\r\n]*\[(?:file|image):[^\]]+\]/g, "").trim()

    const mappedBranches = message.branches && message.branches.length > 0
      ? message.branches.map((b, bIdx) => mapBackendBranchMessages(b, bIdx, message.created_at ?? detail.updated))
      : undefined

    if (mappedBranches && mappedBranches.length > 0) {
      for (let b = 0; b < mappedBranches.length; b++) {
        if (mappedBranches[b][0]) {
          mappedBranches[b][0].branches = mappedBranches
          mappedBranches[b][0].activeBranchIndex = b
          if (message.branch_type) {
            mappedBranches[b][0].branchType = message.branch_type
          }
        }
      }
    }

    return {
      id: message.id || `hist-${index}-${message.created_at ?? detail.updated}`,
      role: message.role,
      content,
      kind: message.role === "assistant" ? (message.kind ?? "normal") : undefined,
      modelName: message.model_name,
      toolCalls:
        message.role === "assistant"
          ? parseToolCallsValue(message.tool_calls)
          : undefined,
      attachments,
      timestamp: message.created_at ?? detail.updated,
      branches: mappedBranches,
      activeBranchIndex: message.active_branch_index ?? (mappedBranches ? mappedBranches.length - 1 : 0),
      branchType: message.branch_type,
    }
  })
}

function normalizeMessageTimestamp(timestamp: number | string): string {
  if (typeof timestamp === "number") {
    return String(normalizeUnixTimestamp(timestamp))
  }

  const trimmed = timestamp.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return String(normalizeUnixTimestamp(Number(trimmed)))
  }

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? trimmed : String(parsed)
}

// Signature WITHOUT timestamp — used for deduplication between history (backend
// created_at timestamps) and in-memory messages (Date.now() timestamps).
// Including the timestamp caused duplicates on tab-switch because the same
// message has two different timestamp values in the two sources.
function messageContentSignature(message: ChatMessage): string {
  const attachmentSignature = (message.attachments ?? [])
    .map(
      (attachment) =>
        `${attachment.type}\u0001${attachment.url}\u0001${attachment.filename ?? ""}`,
    )
    .join("\u0002")

  return `${message.role}\u0000${message.content.trim()}\u0000${message.kind ?? ""}\u0000${attachmentSignature}\u0000${toolCallsSignature(
    message.toolCalls,
  )}`
}

function comparableTimestamp(timestamp: number | string): number {
  const normalized = normalizeMessageTimestamp(timestamp)
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : 0
}

export function mergeHistoryMessages(
  historyMessages: ChatMessage[],
  currentMessages: ChatMessage[],
): ChatMessage[] {
  // Build lookup sets from history (the persisted ground truth)
  const historyIds = new Set(historyMessages.map((m) => m.id))
  const historyContentSigs = new Set(
    historyMessages.map((m) => messageContentSignature(m)),
  )

  // Only keep in-memory messages that are NOT already in history.
  // These are truly in-flight (sent but not yet persisted / still streaming).
  const inFlightMessages = currentMessages.filter(
    (m) =>
      !historyIds.has(m.id) &&
      !historyContentSigs.has(messageContentSignature(m)),
  )

  const merged = [...historyMessages, ...inFlightMessages]

  return merged.sort(
    (left, right) =>
      comparableTimestamp(left.timestamp) -
      comparableTimestamp(right.timestamp),
  )
}
