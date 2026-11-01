import { getSessionHistory } from "@/api/sessions"
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

    return {
      id: `hist-${index}-${Date.now()}`,
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

function messageSignature(message: ChatMessage): string {
  const attachmentSignature = (message.attachments ?? [])
    .map(
      (attachment) =>
        `${attachment.type}\u0001${attachment.url}\u0001${attachment.filename ?? ""}`,
    )
    .join("\u0002")

  return `${message.role}\u0000${message.content}\u0000${normalizeMessageTimestamp(
    message.timestamp,
  )}\u0000${message.kind ?? ""}\u0000${message.modelName ?? ""}\u0000${attachmentSignature}\u0000${toolCallsSignature(
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
  const currentIds = new Set(currentMessages.map((message) => message.id))
  const currentSignatures = new Set(
    currentMessages.map((message) => messageSignature(message)),
  )

  const merged = [
    ...historyMessages.filter(
      (message) =>
        !currentIds.has(message.id) &&
        !currentSignatures.has(messageSignature(message)),
    ),
    ...currentMessages,
  ]

  return merged.sort(
    (left, right) =>
      comparableTimestamp(left.timestamp) -
      comparableTimestamp(right.timestamp),
  )
}
