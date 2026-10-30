import { toast } from "sonner"

import {
  parseAssistantMessageCreateState,
  parseAssistantMessageUpdateState,
} from "@/features/chat/assistant-message-state"
import { normalizeUnixTimestamp } from "@/features/chat/state"
import {
  type ChatAttachment,
  type ChatMessage,
  type ContextUsage,
  updateChatStore,
} from "@/store/chat"

import { syncActiveBranches } from "@/features/chat/branches"

export interface PicoMessage {
  type: string
  id?: string
  session_id?: string
  timestamp?: number | string
  payload?: Record<string, unknown>
}

function parseAttachments(
  payload: Record<string, unknown>,
): ChatAttachment[] | undefined {
  const raw = payload.attachments
  if (!Array.isArray(raw)) {
    return undefined
  }

  const attachments: ChatAttachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue
    }

    const attachment = item as Record<string, unknown>
    const url = typeof attachment.url === "string" ? attachment.url : ""
    if (!url) {
      continue
    }

    const type =
      attachment.type === "audio" ||
      attachment.type === "video" ||
      attachment.type === "file" ||
      attachment.type === "image"
        ? attachment.type
        : "file"

    const filename =
      typeof attachment.filename === "string" ? attachment.filename : undefined
    const contentType =
      typeof attachment.content_type === "string"
        ? attachment.content_type
        : undefined

    attachments.push({
      type,
      url,
      ...(filename ? { filename } : {}),
      ...(contentType ? { contentType } : {}),
    })
  }

  return attachments.length > 0 ? attachments : undefined
}

function parseContextUsage(
  payload: Record<string, unknown>,
): ContextUsage | undefined {
  const raw = payload.context_usage
  if (!raw || typeof raw !== "object") return undefined
  const obj = raw as Record<string, unknown>
  const used = Number(obj.used_tokens)
  const total = Number(obj.total_tokens)
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0)
    return undefined
  return {
    used_tokens: used,
    total_tokens: total,
    history_tokens: obj.history_tokens != null ? Number(obj.history_tokens) : undefined,
    compress_at_tokens: Number(obj.compress_at_tokens) || 0,
    summarize_at_tokens: obj.summarize_at_tokens != null ? Number(obj.summarize_at_tokens) : undefined,
    used_percent: Number(obj.used_percent) || 0,
  }
}

function parseModelName(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.model_name !== "string") {
    return undefined
  }
  const modelName = payload.model_name.trim()
  return modelName || undefined
}

export function reducePicoMessage(
  prevMessages: ChatMessage[],
  prevIsTyping: boolean,
  message: PicoMessage,
): { messages: ChatMessage[]; isTyping: boolean; contextUsage?: ContextUsage } {
  const payload = message.payload || {}

  switch (message.type) {
    case "message.create":
    case "media.create": {
      const messageId = (payload.message_id as string) || `pico-${Date.now()}`
      const { content, kind, toolCalls } =
        parseAssistantMessageCreateState(payload)
      const attachments = parseAttachments(payload)
      const contextUsage = parseContextUsage(payload)
      const isPlaceholder = payload.placeholder === true
      const modelName = parseModelName(payload)
      const timestamp =
        message.timestamp !== undefined &&
        Number.isFinite(Number(message.timestamp))
          ? normalizeUnixTimestamp(Number(message.timestamp))
          : Date.now()

      const nextMessages = syncActiveBranches([
        ...prevMessages,
        {
          id: messageId,
          role: "assistant",
          content,
          kind,
          ...(modelName ? { modelName } : {}),
          ...(toolCalls ? { toolCalls } : {}),
          attachments,
          timestamp,
        },
      ])

      const isTyping =
        !isPlaceholder && (kind === "normal" || message.type === "media.create")
          ? false
          : prevIsTyping

      return { messages: nextMessages, isTyping, contextUsage }
    }

    case "message.update": {
      const messageId = payload.message_id as string
      const attachments = parseAttachments(payload)
      const contextUsage = parseContextUsage(payload)
      const modelName = parseModelName(payload)
      const timestamp =
        message.timestamp !== undefined &&
        Number.isFinite(Number(message.timestamp))
          ? normalizeUnixTimestamp(Number(message.timestamp))
          : Date.now()
      if (!messageId) {
        return { messages: prevMessages, isTyping: prevIsTyping }
      }

      let found = false
      const messages = prevMessages.map((msg) => {
        if (msg.id !== messageId) {
          return msg
        }
        found = true
        const { content, kind, toolCalls } =
          parseAssistantMessageUpdateState(payload, msg)
        return {
          ...msg,
          id: messageId,
          content,
          kind,
          toolCalls,
          ...(modelName ? { modelName } : {}),
          ...(attachments ? { attachments } : {}),
        }
      })
      const updated = found
        ? messages
        : (() => {
            const { content, kind, toolCalls } =
              parseAssistantMessageUpdateState(payload)
            return [
              ...messages,
              {
                id: messageId,
                role: "assistant" as const,
                content,
                kind,
                toolCalls,
                ...(modelName ? { modelName } : {}),
                ...(attachments ? { attachments } : {}),
                timestamp,
              },
            ]
          })()

      const nextMessages = syncActiveBranches(updated)
      return { messages: nextMessages, isTyping: prevIsTyping, contextUsage }
    }

    case "message.delete": {
      const messageId = payload.message_id as string
      if (!messageId) {
        return { messages: prevMessages, isTyping: prevIsTyping }
      }
      return {
        messages: prevMessages.filter((msg) => msg.id !== messageId),
        isTyping: prevIsTyping,
      }
    }

    case "typing.start":
      return { messages: prevMessages, isTyping: true }

    case "typing.stop":
      return { messages: prevMessages, isTyping: false }

    case "error": {
      const requestId =
        typeof payload.request_id === "string" ? payload.request_id : ""
      return {
        messages: requestId
          ? prevMessages.filter((msg) => msg.id !== requestId)
          : prevMessages,
        isTyping: false,
      }
    }

    default:
      return { messages: prevMessages, isTyping: prevIsTyping }
  }
}

export function handlePicoMessage(
  message: PicoMessage,
  expectedSessionId: string,
) {
  if (message.session_id && message.session_id !== expectedSessionId) {
    return
  }

  const payload = message.payload || {}
  if (
    message.type === "error" &&
    typeof payload.message === "string" &&
    payload.message
  ) {
    toast.error(payload.message)
  }

  updateChatStore((prev) => {
    const result = reducePicoMessage(prev.messages, prev.isTyping, message)
    return {
      messages: result.messages,
      isTyping: result.isTyping,
      ...(result.contextUsage ? { contextUsage: result.contextUsage } : {}),
    }
  })
}

