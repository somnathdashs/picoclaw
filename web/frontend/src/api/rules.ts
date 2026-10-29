import { launcherFetch } from "@/api/http"

export interface RulesResponse {
  path: string
  content: string
  exists: boolean
  updated_at?: number
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ""
    try {
      const text = await res.text()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          detail = parsed.message || parsed.error || text
        } catch {
          detail = text.trim()
        }
      }
    } catch {
      // Ignore text parse error
    }
    throw new Error(detail || `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function getRules(): Promise<RulesResponse> {
  const res = await launcherFetch("/api/rules")
  return handleResponse<RulesResponse>(res)
}

export async function updateRules(content: string): Promise<RulesResponse> {
  const res = await launcherFetch("/api/rules", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  return handleResponse<RulesResponse>(res)
}

export async function resetRules(): Promise<RulesResponse> {
  const res = await launcherFetch("/api/rules", {
    method: "DELETE",
  })
  return handleResponse<RulesResponse>(res)
}
