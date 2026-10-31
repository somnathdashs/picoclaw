import { launcherFetch } from "@/api/http"

export interface WorkspaceUploadFileItem {
  filename: string
  path: string
  size: number
  ref?: string
}

export interface WorkspaceUploadResponse {
  success: boolean
  files: WorkspaceUploadFileItem[]
  message?: string
}

export async function uploadToWorkspace(file: File): Promise<WorkspaceUploadFileItem> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await launcherFetch("/api/workspace/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || `Upload failed with status ${res.status}`)
  }

  const data = (await res.json()) as WorkspaceUploadResponse
  if (!data.success || !data.files || data.files.length === 0) {
    throw new Error(data.message || "Failed to upload file")
  }

  return data.files[0]
}
