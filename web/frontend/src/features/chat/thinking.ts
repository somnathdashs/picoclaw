import type { ChatToolCall } from "@/store/chat"

export interface ExtractedThinkTags {
  thought?: string
  thoughts: string[]
  cleanContent: string
  isStreamingThought?: boolean
}

export type WorkStep =
  | {
      type: "thought"
      id: string
      content: string
      timestamp?: string | number
    }
  | {
      type: "tool"
      id: string
      toolCall: ChatToolCall
      timestamp?: string | number
    }

export function extractThinkTags(raw?: string): ExtractedThinkTags {
  if (!raw) return { thoughts: [], cleanContent: "" }

  const openThinkMatch = raw.match(/^[\s\r\n]*<\s*(?:think|thought)\s*>([\s\S]*)$/i)
  if (
    openThinkMatch &&
    !raw.toLowerCase().includes("</think>") &&
    !raw.toLowerCase().includes("</thought>")
  ) {
    const th = openThinkMatch[1].trim()
    return {
      thought: th,
      thoughts: th ? [th] : [],
      cleanContent: "",
      isStreamingThought: true,
    }
  }

  const thinkRegex = /<\s*(?:think|thought)\s*>([\s\S]*?)<\/\s*(?:think|thought)\s*>/gi
  const thoughts: string[] = []
  let match: RegExpExecArray | null
  while ((match = thinkRegex.exec(raw)) !== null) {
    if (match[1]?.trim()) {
      thoughts.push(match[1].trim())
    }
  }

  let remainder = raw.replace(thinkRegex, "").trim()
  const trailingOpenMatch = remainder.match(/<\s*(?:think|thought)\s*>([\s\S]*)$/i)
  if (trailingOpenMatch && trailingOpenMatch.index !== undefined) {
    const trailingThought = trailingOpenMatch[1].trim()
    if (trailingThought) {
      thoughts.push(trailingThought)
    }
    remainder = remainder.slice(0, trailingOpenMatch.index).trim()
  }

  return {
    thought: thoughts.length > 0 ? thoughts.join("\n\n---\n\n") : undefined,
    thoughts,
    cleanContent: remainder,
    isStreamingThought: false,
  }
}
