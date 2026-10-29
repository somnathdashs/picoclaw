import { useEffect, useRef, useState } from "react"

function cleanMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function useSpeechSynthesis() {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  )
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setSpeakingMessageId(null)
    utteranceRef.current = null
  }

  const speak = (messageId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return
    }

    if (speakingMessageId === messageId) {
      stop()
      return
    }

    window.speechSynthesis.cancel()
    const cleanText = cleanMarkdownForSpeech(text)
    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utteranceRef.current = utterance

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

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    speakingMessageId,
    isSpeaking: speakingMessageId !== null,
    speak,
    stop,
  }
}
