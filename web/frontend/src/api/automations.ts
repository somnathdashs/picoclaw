import { launcherFetch } from "@/api/http"

export interface CronSchedule {
  kind: "at" | "every" | "cron"
  atMs?: number
  everyMs?: number
  expr?: string
  tz?: string
}

export interface CronPayload {
  kind: string
  message: string
  command?: string
  channel?: string
  to?: string
  deliver?: boolean
  Command?: string
  Channel?: string
  Message?: string
  To?: string
  Deliver?: boolean
}

export interface CronRunRecord {
  runAtMs: number
  durationMs: number
  status: "ok" | "error" | "running" | string
  error?: string
  output?: string
  Error?: string
  Output?: string
}

export interface CronJobState {
  nextRunAtMs?: number
  lastRunAtMs?: number
  lastStatus?: string
  lastError?: string
  lastOutput?: string
  history?: CronRunRecord[]
  NextRunAtMS?: number
  LastRunAtMS?: number
  LastStatus?: string
  LastError?: string
  LastOutput?: string
  History?: CronRunRecord[]
}

export interface AutomationJob {
  id: string
  name: string
  enabled: boolean
  schedule: CronSchedule
  payload: CronPayload
  state: CronJobState
  createdAtMs: number
  updatedAtMs: number
  deleteAfterRun: boolean

  // Compatibility aliases
  ID?: string
  Name?: string
  Enabled?: boolean
  Schedule?: CronSchedule
  Payload?: CronPayload
  State?: CronJobState
  DeleteAfterRun?: boolean
}

export interface AutomationsListResponse {
  jobs: AutomationJob[]
  count: number
  status: {
    enabled: boolean
    jobs: number
    nextWakeAtMS?: number | null
  }
}

export interface CreateAutomationInput {
  name: string
  schedule: CronSchedule
  payload: CronPayload
  enabled?: boolean
  deleteAfterRun?: boolean
}

export async function getAutomations(): Promise<AutomationsListResponse> {
  const res = await launcherFetch("/api/automations")
  if (!res.ok) {
    throw new Error(`Failed to fetch automations: ${res.statusText}`)
  }
  return res.json() as Promise<AutomationsListResponse>
}

export async function createAutomation(
  input: CreateAutomationInput,
): Promise<AutomationJob> {
  const res = await launcherFetch("/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || "Failed to create automation")
  }
  return res.json() as Promise<AutomationJob>
}

export async function updateAutomation(
  id: string,
  input: Partial<CreateAutomationInput>,
): Promise<AutomationJob> {
  const res = await launcherFetch(
    `/api/automations/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || "Failed to update automation")
  }
  return res.json() as Promise<AutomationJob>
}

export async function deleteAutomation(id: string): Promise<void> {
  const res = await launcherFetch(
    `/api/automations/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  )
  if (!res.ok) {
    throw new Error("Failed to delete automation")
  }
}

export async function toggleAutomation(
  id: string,
  enabled?: boolean,
): Promise<AutomationJob> {
  const res = await launcherFetch(
    `/api/automations/${encodeURIComponent(id)}/toggle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  )
  if (!res.ok) {
    throw new Error("Failed to toggle automation")
  }
  return res.json() as Promise<AutomationJob>
}

export async function runAutomationNow(id: string): Promise<void> {
  const res = await launcherFetch(
    `/api/automations/${encodeURIComponent(id)}/run`,
    {
      method: "POST",
    },
  )
  if (!res.ok) {
    throw new Error("Failed to run automation")
  }
}
