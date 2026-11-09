import { useMemo } from "react"
import type { ChatMessage } from "@/store/chat"

export type AgentBrowserAction =
  | "open"
  | "snapshot"
  | "click"
  | "fill"
  | "type"
  | "select"
  | "press"
  | "scroll"
  | "wait"
  | "screenshot"
  | "pdf"
  | "eval"
  | "get"
  | "close"
  | "state"
  | "other"

export interface AgentBrowserElement {
  id: string
  ref: string
  tag: string
  label: string
}

export interface AgentBrowserStep {
  id: string
  action: AgentBrowserAction
  command: string
  url?: string
  ref?: string
  value?: string
  output?: string
  timestamp: number
  isExecuting?: boolean
  hasError?: boolean
}

export interface AgentBrowserActivity {
  activeUrl: string
  activeTitle: string
  isBrowsingActive: boolean
  lastStep?: AgentBrowserStep
  steps: AgentBrowserStep[]
  elements: AgentBrowserElement[]
  profile?: string
  sessionName?: string
  screenshotUrl?: string
}

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18790"

// Parse interactive elements from agent-browser snapshot text
export function parseSnapshotElements(text: string): AgentBrowserElement[] {
  if (!text) return []
  const elements: AgentBrowserElement[] = []
  const regex = /@(e\d+)\s+\[([^\]]+)\](?:\s+(?:"([^"]*)"|'([^']*)'|([^\n\r,;]+)))?/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const ref = `@${match[1]}`
    const tag = match[2]?.trim() || "element"
    const label = (match[3] || match[4] || match[5] || "").trim()
    elements.push({
      id: `${ref}-${elements.length}`,
      ref,
      tag,
      label,
    })
  }

  return elements
}

function extractToolString(value: unknown): string {
  if (typeof value === "string") return value
  if (!value) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseCommandLine(cmd: string): {
  action: AgentBrowserAction
  url?: string
  ref?: string
  value?: string
  profile?: string
  sessionName?: string
} {
  const trimmed = cmd.trim()

  const profileMatch = trimmed.match(/--profile\s+([^\s]+)/)
  const profile = profileMatch ? profileMatch[1] : undefined

  const sessionMatch = trimmed.match(/--(?:session|session-name)\s+([^\s]+)/)
  const sessionName = sessionMatch ? sessionMatch[1] : undefined

  const urlMatch = trimmed.match(/(?:open|--url)\s+["']?(https?:\/\/[^\s"']+)["']?/i)
  const url = urlMatch ? urlMatch[1] : undefined

  let action: AgentBrowserAction = "other"
  if (/\bopen\b/i.test(trimmed)) action = "open"
  else if (/\bsnapshot\b/i.test(trimmed)) action = "snapshot"
  else if (/\bclick\b/i.test(trimmed)) action = "click"
  else if (/\bfill\b/i.test(trimmed)) action = "fill"
  else if (/\btype\b/i.test(trimmed)) action = "type"
  else if (/\bselect\b/i.test(trimmed)) action = "select"
  else if (/\bpress\b/i.test(trimmed)) action = "press"
  else if (/\bscroll\b/i.test(trimmed)) action = "scroll"
  else if (/\bwait\b/i.test(trimmed)) action = "wait"
  else if (/\bscreenshot\b/i.test(trimmed)) action = "screenshot"
  else if (/\bpdf\b/i.test(trimmed)) action = "pdf"
  else if (/\beval\b/i.test(trimmed)) action = "eval"
  else if (/\bget\b/i.test(trimmed)) action = "get"
  else if (/\bclose\b/i.test(trimmed)) action = "close"
  else if (/\bstate\b/i.test(trimmed)) action = "state"

  const refMatch = trimmed.match(/(@e\d+)/)
  const ref = refMatch ? refMatch[1] : undefined

  const valueMatch = trimmed.match(/(?:fill|type|select)\s+@e\d+\s+["']([^"']+)["']/i)
  const value = valueMatch ? valueMatch[1] : undefined

  return { action, url, ref, value, profile, sessionName }
}

export function extractAgentBrowserActivity(
  messages: readonly ChatMessage[],
  isTurnStreaming = false,
): AgentBrowserActivity {
  const steps: AgentBrowserStep[] = []
  let activeUrl = DEFAULT_GATEWAY_URL
  let activeTitle = "Gateway Profile"
  let latestElements: AgentBrowserElement[] = []
  let activeProfile: string | undefined
  let activeSessionName: string | undefined
  let screenshotUrl: string | undefined

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const isLastMessage = i === messages.length - 1
    const toolCalls = msg.toolCalls || []

    for (let tIdx = 0; tIdx < toolCalls.length; tIdx++) {
      const tc = toolCalls[tIdx]
      const funcName = tc.function?.name?.toLowerCase() || ""
      const rawArgs = tc.function?.arguments || ""

      let commandStr = ""
      try {
        const parsed = JSON.parse(rawArgs)
        commandStr =
          parsed.command ||
          parsed.CommandLine ||
          parsed.cmd ||
          (typeof parsed.action === "string" ? `${parsed.action} ${parsed.url || ""}` : "")
      } catch {
        commandStr = rawArgs
      }

      const isBrowserTool =
        funcName.includes("agent-browser") ||
        funcName.includes("agent_browser") ||
        funcName.includes("browser") ||
        commandStr.includes("agent-browser")

      if (!isBrowserTool) continue

      const output =
        extractToolString(tc.result) ||
        extractToolString(tc.output) ||
        extractToolString(tc.response) ||
        extractToolString(tc.extraContent?.result) ||
        extractToolString(tc.extraContent?.output) ||
        tc.extraContent?.toolFeedbackExplanation ||
        ""

      const parsedCmd = parseCommandLine(commandStr)
      if (parsedCmd.url) activeUrl = parsedCmd.url
      if (parsedCmd.profile) activeProfile = parsedCmd.profile
      if (parsedCmd.sessionName) activeSessionName = parsedCmd.sessionName

      if (parsedCmd.action === "snapshot" || output.includes("@e1")) {
        const foundElems = parseSnapshotElements(output)
        if (foundElems.length > 0) latestElements = foundElems
      }

      const titleMatch = output.match(/title:\s*([^\n\r]+)/i) || output.match(/document\.title\s*=\s*["']([^"']+)["']/i)
      if (titleMatch) activeTitle = titleMatch[1].trim()

      const imgMatch = output.match(/(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp))|(data:image\/[a-z]+;base64,[^\s"']+)|(\/[^\s"']+\.(?:png|jpg|jpeg|webp))/i)
      if (imgMatch) screenshotUrl = imgMatch[0]

      const isExecuting = Boolean(isTurnStreaming && isLastMessage && tIdx === toolCalls.length - 1)
      const hasError = output.toLowerCase().includes("error") || output.toLowerCase().includes("failed")

      const ts =
        typeof msg.timestamp === "number"
          ? msg.timestamp
          : Date.parse(String(msg.timestamp)) || Date.now()

      steps.push({
        id: tc.id || `step-${steps.length}`,
        action: parsedCmd.action,
        command: commandStr || `agent-browser ${parsedCmd.action}`,
        url: parsedCmd.url,
        ref: parsedCmd.ref,
        value: parsedCmd.value,
        output,
        timestamp: ts,
        isExecuting,
        hasError,
      })
    }
  }

  const lastStep = steps.length > 0 ? steps[steps.length - 1] : undefined
  const isBrowsingActive = Boolean(lastStep?.isExecuting)

  return {
    activeUrl,
    activeTitle,
    isBrowsingActive,
    lastStep,
    steps,
    elements: latestElements,
    profile: activeProfile,
    sessionName: activeSessionName,
    screenshotUrl,
  }
}

export function useAgentBrowserTracker(
  messages: readonly ChatMessage[],
  isTurnStreaming = false,
): AgentBrowserActivity {
  return useMemo(
    () => extractAgentBrowserActivity(messages, isTurnStreaming),
    [messages, isTurnStreaming],
  )
}
