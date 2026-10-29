import { launcherFetch } from "@/api/http"

export interface SessionSummary {
  id: string
  title: string
  preview: string
  message_count: number
  type?: string
  channel?: string
  sender?: string
  chat?: string
  created: string
  updated: string
  score?: number
  match_snippet?: string
}

export interface SessionDetail {
  id: string
  messages: {
    role: "user" | "assistant"
    content: string
    created_at?: string
    kind?: "normal" | "thought" | "tool_calls"
    model_name?: string
    media?: string[]
    attachments?: {
      type?: "image" | "audio" | "video" | "file"
      url: string
      filename?: string
      content_type?: string
    }[]
    tool_calls?: {
      id?: string
      type?: string
      function?: {
        name?: string
        arguments?: string
      }
      extra_content?: {
        tool_feedback_explanation?: string
        result?: unknown
        output?: unknown
      }
      result?: unknown
      output?: unknown
    }[]
  }[]
  summary: string
  created: string
  updated: string
}

const CACHE_KEY = "picoclaw_sessions_cache"

export function getCachedSessions(): SessionSummary[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : (parsed.sessions || [])
  } catch {
    return []
  }
}

export function setCachedSessions(sessions: SessionSummary[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sessions))
  } catch {
    // Ignore localStorage write error
  }
}

export function removeCachedSession(id: string): void {
  try {
    const cached = getCachedSessions()
    setCachedSessions(cached.filter((s) => s.id !== id))
  } catch {
    // Ignore localStorage write error
  }
}

export function clearCachedSessions(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore localStorage write error
  }
}

export async function getSessions(
  offset: number = 0,
  limit: number = 20,
  type?: string,
  sender?: string,
  query?: string,
): Promise<SessionSummary[]> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  })
  if (type && type !== "all") {
    params.set("type", type)
  }
  if (sender && sender !== "all") {
    params.set("sender", sender)
  }
  if (query && query.trim()) {
    params.set("q", query.trim())
  }

  const res = await launcherFetch(`/api/sessions?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.status}`)
  }
  const data: SessionSummary[] = await res.json()
  if (offset === 0 && !type && !sender && !query && Array.isArray(data)) {
    setCachedSessions(data)
  }
  return data
}

export async function getSessionHistory(id: string): Promise<SessionDetail> {
  const res = await launcherFetch(`/api/sessions/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch session ${id}: ${res.status}`)
  }
  return res.json()
}

export async function exportSessionAsMarkdown(session: {
  id: string
  title?: string
  channel?: string
  sender?: string
}): Promise<void> {
  const detail = await getSessionHistory(session.id)
  const title = session.title || detail.summary || "Untitled Chat"

  const lines: string[] = []
  lines.push(`# ${title}`)
  lines.push("")
  lines.push(`- **Date**: ${new Date(detail.created || detail.updated).toLocaleString()}`)
  lines.push(`- **Session ID**: \`${session.id}\``)
  if (session.channel) {
    lines.push(`- **Channel**: ${session.channel}`)
  }
  if (session.sender) {
    lines.push(`- **Sender**: ${session.sender}`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  for (const msg of detail.messages || []) {
    const roleName = msg.role === "user" ? "User" : `Assistant (${msg.model_name || "Bot"})`
    const timestamp = msg.created_at ? ` · ${new Date(msg.created_at).toLocaleTimeString()}` : ""
    lines.push(`### ${roleName}${timestamp}`)
    lines.push("")
    if (msg.content) {
      lines.push(msg.content)
      lines.push("")
    }
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        lines.push(`- Attachment: [${att.filename || att.type || "file"}](${att.url})`)
      }
      lines.push("")
    }
  }

  const content = lines.join("\n")
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const safeFilename = (title || "chat")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 50)

  const a = document.createElement("a")
  a.href = url
  a.download = `${safeFilename}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function deleteSession(id: string): Promise<void> {
  const res = await launcherFetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new Error(`Failed to delete session ${id}: ${res.status}`)
  }
  removeCachedSession(id)
}

export async function clearSessions(type?: string): Promise<{ deleted: number }> {
  const params = new URLSearchParams()
  if (type && type !== "all") {
    params.set("type", type)
  }
  const url = `/api/sessions${params.toString() ? `?${params.toString()}` : ""}`
  const res = await launcherFetch(url, {
    method: "DELETE",
  })
  if (!res.ok) {
    throw new Error(`Failed to clear sessions: ${res.status}`)
  }
  if (!type || type === "all") {
    clearCachedSessions()
  } else {
    const cached = getCachedSessions()
    setCachedSessions(
      cached.filter((s) => (type === "web" ? s.type !== "web" : s.type !== type && s.channel !== type)),
    )
  }
  return res.json()
}
