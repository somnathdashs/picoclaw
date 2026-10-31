import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { voiceAgentSettingsAtom } from "@/store/voice-agent"

interface SpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      [index: number]: {
        transcript: string
      }
    }
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
}

export function useSpeechRecognition({
  onTranscript,
  onAutoSend,
  currentValue,
}: {
  onTranscript: (fullText: string) => void
  onAutoSend?: () => void
  currentValue?: string
}) {
  const settings = useAtomValue(voiceAgentSettingsAtom)
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const baseTextRef = useRef<string>("")
  const currentValueRef = useRef(currentValue ?? "")
  const lastSpokenRef = useRef<string>("")
  const isListeningRef = useRef(false)

  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const onAutoSendRef = useRef(onAutoSend)
  onAutoSendRef.current = onAutoSend

  currentValueRef.current = currentValue ?? ""
  isListeningRef.current = isListening

  // Check browser support on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(Boolean(SpeechRecognitionAPI))
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(async () => {
    if (!settings.stt.enabled) {
      toast.info("Voice input (STT) is disabled in Voice Agent settings.")
      return
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is not supported in this browser.")
      return
    }

    // Stop any existing session before creating a fresh instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    try {
      // Request microphone permissions explicitly if supported
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (err: any) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            toast.error("Microphone permission denied. Please allow microphone access in your browser.")
            return
          }
        }
      }

      const instance: SpeechRecognitionInstance = new SpeechRecognitionAPI()
      instance.continuous = settings.stt.continuous
      instance.interimResults = settings.stt.interimResults
      instance.lang = settings.stt.language || navigator.language || "en-US"

      baseTextRef.current = currentValueRef.current.trim()
      lastSpokenRef.current = ""

      instance.onstart = () => {
        setIsListening(true)
      }

      instance.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
        if (settings.stt.autoSend && lastSpokenRef.current.trim()) {
          lastSpokenRef.current = ""
          onAutoSendRef.current?.()
        }
      }

      instance.onerror = (e) => {
        setIsListening(false)
        recognitionRef.current = null
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          toast.error("Microphone access was denied. Please check your browser microphone permissions.")
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          toast.error(`Voice recognition: ${e.error}`)
        }
      }

      instance.onresult = (event: SpeechRecognitionEvent) => {
        let fullSpoken = ""
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i]
          if (res && res[0]) {
            fullSpoken += res[0].transcript
          }
        }
        const trimmed = fullSpoken.trim()
        if (trimmed) {
          lastSpokenRef.current = trimmed
          const base = baseTextRef.current
          const combined = base ? `${base} ${trimmed}` : trimmed
          onTranscriptRef.current(combined)
        }
      }

      recognitionRef.current = instance
      instance.start()
    } catch (err: any) {
      setIsListening(false)
      recognitionRef.current = null
      console.error("Failed to start speech recognition:", err)
      toast.error(`Failed to start microphone: ${err?.message || err}`)
    }
  }, [
    settings.stt.enabled,
    settings.stt.continuous,
    settings.stt.interimResults,
    settings.stt.language,
    settings.stt.autoSend,
  ])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      void startListening()
    }
  }, [startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    toggleListening,
    startListening,
    stopListening,
    sttSettings: settings.stt,
  }
}
