import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

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
  currentValue,
}: {
  onTranscript: (fullText: string) => void
  currentValue?: string
}) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const baseTextRef = useRef<string>("")
  const currentValueRef = useRef(currentValue ?? "")

  currentValueRef.current = currentValue ?? ""

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognitionAPI =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionInstance
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionInstance
        }
      ).webkitSpeechRecognition

    if (SpeechRecognitionAPI) {
      setIsSupported(true)
      try {
        const instance = new SpeechRecognitionAPI()
        instance.continuous = true
        instance.interimResults = true
        instance.lang = navigator.language || "en-US"

        instance.onstart = () => {
          setIsListening(true)
        }

        instance.onend = () => {
          setIsListening(false)
        }

        instance.onerror = (e) => {
          setIsListening(false)
          if (e.error !== "no-speech" && e.error !== "aborted") {
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
            const base = baseTextRef.current
            const combined = base ? `${base} ${trimmed}` : trimmed
            onTranscript(combined)
          }
        }

        recognitionRef.current = instance
      } catch (err) {
        console.error("Failed to initialize speech recognition:", err)
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore cleanup abort
        }
      }
    }
  }, [onTranscript])

  const toggleListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.")
      return
    }

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    } else {
      try {
        baseTextRef.current = currentValueRef.current.trim()
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.error("Failed to start speech recognition:", err)
        setIsListening(false)
      }
    }
  }, [isListening, isSupported])

  return {
    isListening,
    isSupported,
    toggleListening,
  }
}
