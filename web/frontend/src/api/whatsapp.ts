import { launcherFetch } from "@/api/http"

export interface WhatsAppStatus {
  enabled: boolean
  use_native: boolean
  bridge_url: string
  session_store_path: string
  has_session_file: boolean
  linked: boolean
  jid?: string
  phone?: string
  push_name?: string
  gateway_running: boolean
  qr_data_uri?: string
  qr_code?: string
  error?: string
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await launcherFetch("/api/whatsapp/status")
  if (!res.ok) {
    throw new Error(`Failed to fetch WhatsApp status: ${res.statusText}`)
  }
  return res.json() as Promise<WhatsAppStatus>
}

export async function unlinkWhatsApp(): Promise<{
  success: boolean
  message: string
}> {
  const res = await launcherFetch("/api/whatsapp/unlink", {
    method: "POST",
  })
  if (!res.ok) {
    throw new Error(`Failed to unlink WhatsApp: ${res.statusText}`)
  }
  return res.json() as Promise<{ success: boolean; message: string }>
}

export async function startWhatsAppLinking(): Promise<{
  success: boolean
  message: string
}> {
  const res = await launcherFetch("/api/whatsapp/link", {
    method: "POST",
  })
  if (!res.ok) {
    throw new Error(`Failed to start WhatsApp linking: ${res.statusText}`)
  }
  return res.json() as Promise<{ success: boolean; message: string }>
}

export async function cancelWhatsAppLinking(): Promise<{
  success: boolean
  message: string
}> {
  const res = await launcherFetch("/api/whatsapp/cancel-link", {
    method: "POST",
  })
  if (!res.ok) {
    throw new Error(`Failed to cancel WhatsApp linking: ${res.statusText}`)
  }
  return res.json() as Promise<{ success: boolean; message: string }>
}
