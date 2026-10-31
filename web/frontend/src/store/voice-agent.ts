import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface EdgeVoiceOption {
  id: string
  name: string
  lang: string
  gender: "Female" | "Male"
}

export const EDGE_VOICES: EdgeVoiceOption[] = [
  { id: "en-US-AriaNeural", name: "Aria (US English)", lang: "en-US", gender: "Female" },
  { id: "en-US-GuyNeural", name: "Guy (US English)", lang: "en-US", gender: "Male" },
  { id: "en-US-JennyNeural", name: "Jenny (US English)", lang: "en-US", gender: "Female" },
  { id: "en-US-ChristopherNeural", name: "Christopher (US English)", lang: "en-US", gender: "Male" },
  { id: "en-US-EricNeural", name: "Eric (US English)", lang: "en-US", gender: "Male" },
  { id: "en-GB-SoniaNeural", name: "Sonia (UK English)", lang: "en-GB", gender: "Female" },
  { id: "en-GB-RyanNeural", name: "Ryan (UK English)", lang: "en-GB", gender: "Male" },
  { id: "en-IN-NeerjaNeural", name: "Neerja (Indian English)", lang: "en-IN", gender: "Female" },
  { id: "en-IN-PrabhatNeural", name: "Prabhat (Indian English)", lang: "en-IN", gender: "Male" },
  { id: "es-ES-ElviraNeural", name: "Elvira (Spanish - Spain)", lang: "es-ES", gender: "Female" },
  { id: "es-ES-AlvaroNeural", name: "Alvaro (Spanish - Spain)", lang: "es-ES", gender: "Male" },
  { id: "es-MX-DaliaNeural", name: "Dalia (Spanish - Mexico)", lang: "es-MX", gender: "Female" },
  { id: "fr-FR-DeniseNeural", name: "Denise (French)", lang: "fr-FR", gender: "Female" },
  { id: "fr-FR-HenriNeural", name: "Henri (French)", lang: "fr-FR", gender: "Male" },
  { id: "de-DE-KatjaNeural", name: "Katja (German)", lang: "de-DE", gender: "Female" },
  { id: "de-DE-ConradNeural", name: "Conrad (German)", lang: "de-DE", gender: "Male" },
  { id: "it-IT-ElsaNeural", name: "Elsa (Italian)", lang: "it-IT", gender: "Female" },
  { id: "pt-BR-FranciscaNeural", name: "Francisca (Portuguese - Brazil)", lang: "pt-BR", gender: "Female" },
  { id: "pt-BR-AntonioNeural", name: "Antonio (Portuguese - Brazil)", lang: "pt-BR", gender: "Male" },
  { id: "zh-CN-XiaoxiaoNeural", name: "Xiaoxiao (Chinese - Mandarin)", lang: "zh-CN", gender: "Female" },
  { id: "zh-CN-YunxiNeural", name: "Yunxi (Chinese - Mandarin)", lang: "zh-CN", gender: "Male" },
  { id: "ja-JP-NanamiNeural", name: "Nanami (Japanese)", lang: "ja-JP", gender: "Female" },
  { id: "ja-JP-KeitaNeural", name: "Keita (Japanese)", lang: "ja-JP", gender: "Male" },
  { id: "ko-KR-SunHiNeural", name: "Sun-Hi (Korean)", lang: "ko-KR", gender: "Female" },
  { id: "bn-IN-TanishaaNeural", name: "Tanishaa (Bengali)", lang: "bn-IN", gender: "Female" },
  { id: "cs-CZ-VlastaNeural", name: "Vlasta (Czech)", lang: "cs-CZ", gender: "Female" },
  { id: "ru-RU-SvetlanaNeural", name: "Svetlana (Russian)", lang: "ru-RU", gender: "Female" },
  { id: "hi-IN-SwaraNeural", name: "Swara (Hindi)", lang: "hi-IN", gender: "Female" },
  { id: "ar-SA-ZariyahNeural", name: "Zariyah (Arabic)", lang: "ar-SA", gender: "Female" },
]

export interface VoiceAgentSettings {
  stt: {
    enabled: boolean
    engine: "system"
    language: string
    continuous: boolean
    interimResults: boolean
    autoSend: boolean
  }
  tts: {
    enabled: boolean
    engine: "system" | "edge"
    autoReadOnMic: boolean
    autoRead?: boolean
    systemVoice: string
    systemRate: number
    systemPitch: number
    systemVolume: number
    edgeVoice: string
    edgeRate: string
    edgePitch: string
    edgeVolume: number
    edgeCustomEndpoint?: string
  }
}

export const DEFAULT_VOICE_AGENT_SETTINGS: VoiceAgentSettings = {
  stt: {
    enabled: true,
    engine: "system",
    language: "",
    continuous: true,
    interimResults: true,
    autoSend: false,
  },
  tts: {
    enabled: true,
    engine: "system",
    autoReadOnMic: false,
    autoRead: false,
    systemVoice: "",
    systemRate: 1,
    systemPitch: 1,
    systemVolume: 1,
    edgeVoice: "en-US-AriaNeural",
    edgeRate: "+0%",
    edgePitch: "+0Hz",
    edgeVolume: 1,
    edgeCustomEndpoint: "",
  },
}

let inMemorySettings: VoiceAgentSettings | null = null

function deepMergeSettings(raw: any): VoiceAgentSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_VOICE_AGENT_SETTINGS
  return {
    stt: {
      ...DEFAULT_VOICE_AGENT_SETTINGS.stt,
      ...(raw.stt || {}),
    },
    tts: {
      ...DEFAULT_VOICE_AGENT_SETTINGS.tts,
      ...(raw.tts || {}),
    },
  }
}

// Purges disposable cache entries to free storage space when quota is exceeded
function purgeDisposableStorage() {
  if (typeof window === "undefined" || !window.localStorage) return
  const disposableKeys = [
    "picoclaw_dashboard_summary_cache",
    "picoclaw_sessions_cache",
    "picoclaw_history_view_mode",
  ]
  for (const key of disposableKeys) {
    try {
      window.localStorage.removeItem(key)
    } catch {}
  }

  const protectedKeys = new Set([
    "picoclaw_voice_agent_settings",
    "picoclaw:chat-assistant-detail-visibility",
    "app_theme_id",
    "theme",
    "picoclaw:last-active-session",
    "sidebar_open",
    "sidebar_width",
  ])

  try {
    const total = window.localStorage.length
    const toRemove: string[] = []
    for (let i = 0; i < total; i++) {
      const k = window.localStorage.key(i)
      if (k && !protectedKeys.has(k)) {
        const val = window.localStorage.getItem(k)
        if (val && val.length > 20000) toRemove.push(k)
      }
    }
    for (const k of toRemove) {
      window.localStorage.removeItem(k)
    }
  } catch {}
}

// Proactively free storage space on initialization
purgeDisposableStorage()

const voiceAgentStorage = {
  getItem(key: string, initialValue: VoiceAgentSettings): VoiceAgentSettings {
    if (typeof window === "undefined") return initialValue
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        const merged = deepMergeSettings(parsed)
        inMemorySettings = merged
        return merged
      }
    } catch {}

    try {
      const rawSession = window.sessionStorage.getItem(key)
      if (rawSession) {
        const parsed = JSON.parse(rawSession)
        const merged = deepMergeSettings(parsed)
        inMemorySettings = merged
        return merged
      }
    } catch {}

    if (inMemorySettings) return inMemorySettings
    return initialValue
  },

  setItem(key: string, newValue: VoiceAgentSettings): void {
    inMemorySettings = newValue
    if (typeof window === "undefined") return
    const serialized = JSON.stringify(newValue)

    try {
      window.localStorage.setItem(key, serialized)
      return
    } catch {
      purgeDisposableStorage()
      try {
        window.localStorage.setItem(key, serialized)
        return
      } catch {
        try {
          window.sessionStorage.setItem(key, serialized)
        } catch {}
      }
    }
  },

  removeItem(key: string): void {
    inMemorySettings = null
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(key)
    } catch {}
    try {
      window.sessionStorage.removeItem(key)
    } catch {}
  },

  subscribe(key: string, callback: (value: VoiceAgentSettings) => void) {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return undefined
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return
      try {
        const raw = event.newValue || window.localStorage.getItem(key)
        if (raw) {
          callback(deepMergeSettings(JSON.parse(raw)))
        }
      } catch {}
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  },
}

export const voiceAgentSettingsAtom = atomWithStorage<VoiceAgentSettings>(
  "picoclaw_voice_agent_settings",
  DEFAULT_VOICE_AGENT_SETTINGS,
  voiceAgentStorage,
  { getOnInit: true },
)

export const lastInputWasVoiceAtom = atom<boolean>(false)

