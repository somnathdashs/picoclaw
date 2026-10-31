import { useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { playEdgeTts, stopActiveEdgeTts } from "@/lib/edge-tts"
import { voiceAgentSettingsAtom } from "@/store/voice-agent"

export function cleanMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function useSpeechSynthesis() {
  const settings = useAtomValue(voiceAgentSettingsAtom)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const currentSpeakingIdRef = useRef<string | null>(null)

  currentSpeakingIdRef.current = speakingMessageId

  const stop = () => {
    stopActiveEdgeTts()
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setSpeakingMessageId(null)
    utteranceRef.current = null
  }

  const speakSystem = (messageId: string, cleanText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("System speech synthesis not supported in this browser.")
      setSpeakingMessageId(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utteranceRef.current = utterance

    const voices = window.speechSynthesis.getVoices()
    if (settings.tts.systemVoice) {
      const matched = voices.find(
        (v) => v.voiceURI === settings.tts.systemVoice || v.name === settings.tts.systemVoice,
      )
      if (matched) {
        utterance.voice = matched
      }
    }

    utterance.rate = Math.max(0.5, Math.min(2.0, settings.tts.systemRate || 1.0))
    utterance.pitch = Math.max(0.5, Math.min(1.5, settings.tts.systemPitch || 1.0))
    utterance.volume = Math.max(0, Math.min(1.0, settings.tts.systemVolume || 1.0))

    utterance.onend = () => {
      setSpeakingMessageId(null)
      utteranceRef.current = null
    }

    utterance.onerror = () => {
      setSpeakingMessageId(null)
      utteranceRef.current = null
    }

    setSpeakingMessageId(messageId)
    window.speechSynthesis.speak(utterance)
  }

  const speak = (messageId: string, text: string) => {
    if (!settings.tts.enabled) {
      toast.info("Voice output (TTS) is disabled in Voice Agent settings.")
      return
    }

    if (speakingMessageId === messageId) {
      stop()
      return
    }

    stop()
    const cleanText = cleanMarkdownForSpeech(text)
    if (!cleanText) return

    setSpeakingMessageId(messageId)

    if (settings.tts.engine === "edge") {
      playEdgeTts(cleanText, {
        voice: settings.tts.edgeVoice,
        rate: settings.tts.edgeRate,
        pitch: settings.tts.edgePitch,
        volume: settings.tts.edgeVolume,
        customEndpoint: settings.tts.edgeCustomEndpoint,
        onStart: () => {
          setSpeakingMessageId(messageId)
        },
        onEnd: () => {
          setSpeakingMessageId(null)
        },
        onError: (err) => {
          console.warn("Edge TTS error, falling back to System TTS:", err)
          speakSystem(messageId, cleanText)
        },
      }).catch((err) => {
        console.warn("Edge TTS connection failed, falling back to System TTS:", err)
        speakSystem(messageId, cleanText)
      })
      return
    }

    speakSystem(messageId, cleanText)
  }

  useEffect(() => {
    return () => {
      stop()
    }
  }, [])

  return {
    speakingMessageId,
    isSpeaking: speakingMessageId !== null,
    speak,
    stop,
    ttsSettings: settings.tts,
  }
}
