import { extractThinkTags } from "@/features/chat/thinking"
import {
  parseToolCallsFromContent,
  parseToolCallsValue,
} from "@/features/chat/tool-calls"
import type { AssistantMessageKind, ChatMessage } from "@/store/chat"

type AssistantToolCalls = ChatMessage["toolCalls"]
type ExistingAssistantMessageState = Pick<ChatMessage, "kind" | "toolCalls">

export interface AssistantMessageCreateState {
  content: string
  kind: AssistantMessageKind
  toolCalls?: AssistantToolCalls
}

export interface AssistantMessageUpdateState {
  content: string
  kind: AssistantMessageKind
  toolCalls?: AssistantToolCalls
}

function normalizeAssistantMessageKind(
  payload: Record<string, unknown>,
): string | undefined {
  if (typeof payload.kind !== "string") {
    return undefined
  }
  const kind = payload.kind.trim().toLowerCase()
  return kind || undefined
}

function parseAssistantMessageKind(
  payload: Record<string, unknown>,
  toolCalls?: AssistantToolCalls,
  content?: string,
): AssistantMessageKind {
  const kind = normalizeAssistantMessageKind(payload)
  if (kind === "thought") {
    return "thought"
  }
  if (kind === "tool_calls" || toolCalls) {
    return "tool_calls"
  }
  if (content) {
    const think = extractThinkTags(content)
    if (think.thought && !think.cleanContent) {
      return "thought"
    }
  }
  return "normal"
}

function hasExplicitAssistantKindPayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    normalizeAssistantMessageKind(payload) !== undefined ||
    payload.tool_calls !== undefined
  )
}

function parseAssistantToolCalls(
  payload: Record<string, unknown>,
  content: string,
): AssistantToolCalls {
  return (
    parseToolCallsValue(payload.tool_calls) ??
    parseToolCallsFromContent(content)
  )
}

export function parseAssistantMessageCreateState(
  payload: Record<string, unknown>,
): AssistantMessageCreateState {
  const content = typeof payload.content === "string" ? payload.content : ""
  const toolCalls = parseAssistantToolCalls(payload, content)

  return {
    content,
    kind: parseAssistantMessageKind(payload, toolCalls, content),
    toolCalls,
  }
}

export function parseAssistantMessageUpdateState(
  payload: Record<string, unknown>,
  existing?: ExistingAssistantMessageState,
): AssistantMessageUpdateState {
  const content = typeof payload.content === "string" ? payload.content : ""
  const toolCalls = parseAssistantToolCalls(payload, content)

  if (hasExplicitAssistantKindPayload(payload)) {
    const kind = parseAssistantMessageKind(payload, toolCalls, content)
    return {
      content,
      kind,
      toolCalls: kind === "tool_calls" ? toolCalls : undefined,
    }
  }

  if (toolCalls) {
    return {
      content,
      kind: "tool_calls",
      toolCalls,
    }
  }

  if (existing?.kind === "thought") {
    return {
      content,
      kind: "thought",
      toolCalls: undefined,
    }
  }

  if (existing?.kind === "tool_calls") {
    return {
      content,
      kind: "tool_calls",
      toolCalls: existing.toolCalls,
    }
  }

  if (content) {
    const think = extractThinkTags(content)
    if (think.thought && !think.cleanContent) {
      return {
        content,
        kind: "thought",
        toolCalls: undefined,
      }
    }
  }

  return {
    content,
    kind: existing?.kind ?? "normal",
  }
}
