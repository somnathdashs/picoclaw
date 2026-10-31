import {
  IconArrowLeft,
  IconCheck,
  IconMicrophone,
  IconMicrophoneOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconVolume,
  IconWorld,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useAtom } from "jotai"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"


import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { playEdgeTts, stopActiveEdgeTts } from "@/lib/edge-tts"
import {
  DEFAULT_VOICE_AGENT_SETTINGS,
  EDGE_VOICES,
  type VoiceAgentSettings,
  voiceAgentSettingsAtom,
} from "@/store/voice-agent"

const COMMON_LANGUAGES = [
  { code: "", label: "Browser Default" },
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-IN", label: "English (India)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "de-DE", label: "German (Germany)" },
  { code: "it-IT", label: "Italian (Italy)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "zh-CN", label: "Chinese (Mandarin Simplified)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "bn-IN", label: "Bengali (India)" },
  { code: "cs-CZ", label: "Czech" },
  { code: "ru-RU", label: "Russian" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ar-SA", label: "Arabic" },
]

export function VoiceAgentPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useAtom(voiceAgentSettingsAtom)

  // System voices list
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isTtsPlaying, setIsTtsPlaying] = useState(false)
  const [testText, setTestText] = useState(
    "Hello! I am PicoClaw, your intelligent personal assistant. Voice agent is now ready.",
  )

  // STT test state
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [testTranscript, setTestTranscript] = useState("")
  const testRecognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      setSystemVoices(available)
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
      stopActiveEdgeTts()
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const updateStt = <K extends keyof VoiceAgentSettings["stt"]>(
    key: K,
    val: VoiceAgentSettings["stt"][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      stt: {
        ...prev.stt,
        [key]: val,
      },
    }))
  }

  const updateTts = <K extends keyof VoiceAgentSettings["tts"]>(
    key: K,
    val: VoiceAgentSettings["tts"][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      tts: {
        ...prev.tts,
        [key]: val,
      },
    }))
  }

  const handleResetDefaults = () => {
    setSettings(DEFAULT_VOICE_AGENT_SETTINGS)
    toast.success("Voice Agent settings reset to defaults.")
  }

  // Handle TTS Sample Audio Test
  const handlePlaySample = async () => {
    if (isTtsPlaying) {
      stopActiveEdgeTts()
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      setIsTtsPlaying(false)
      return
    }

    setIsTtsPlaying(true)
    const textToSpeak = testText.trim() || "Testing voice agent output."

    if (settings.tts.engine === "edge") {
      try {
        await playEdgeTts(textToSpeak, {
          voice: settings.tts.edgeVoice,
          rate: settings.tts.edgeRate,
          pitch: settings.tts.edgePitch,
          volume: settings.tts.edgeVolume,
          customEndpoint: settings.tts.edgeCustomEndpoint,
          onStart: () => setIsTtsPlaying(true),
          onEnd: () => setIsTtsPlaying(false),
          onError: (err) => {
            setIsTtsPlaying(false)
            toast.error(`Edge TTS test failed: ${err.message}`)
          },
        })
      } catch (err: any) {
        setIsTtsPlaying(false)
        toast.error(`Edge TTS test connection error: ${err?.message || err}`)
      }
      return
    }

    // System TTS
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsTtsPlaying(false)
      toast.error("Speech synthesis is not supported in this browser.")
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(textToSpeak)

    if (settings.tts.systemVoice) {
      const match = systemVoices.find(
        (v) => v.voiceURI === settings.tts.systemVoice || v.name === settings.tts.systemVoice,
      )
      if (match) utterance.voice = match
    }

    utterance.rate = settings.tts.systemRate
    utterance.pitch = settings.tts.systemPitch
    utterance.volume = settings.tts.systemVolume

    utterance.onend = () => setIsTtsPlaying(false)
    utterance.onerror = () => {
      setIsTtsPlaying(false)
      toast.error("System speech synthesis error.")
    }

    window.speechSynthesis.speak(utterance)
  }

  // Handle STT Live Microphone Test
  const handleToggleMicTest = () => {
    if (isMicTesting) {
      testRecognitionRef.current?.stop()
      setIsMicTesting(false)
      return
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is not supported in this browser.")
      return
    }

    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = settings.stt.language || navigator.language || "en-US"

      recognition.onstart = () => {
        setIsMicTesting(true)
        setTestTranscript("Listening... Speak now.")
      }

      recognition.onresult = (event: any) => {
        let full = ""
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript
        }
        setTestTranscript(full.trim())
      }

      recognition.onerror = (e: any) => {
        setIsMicTesting(false)
        if (e.error !== "no-speech") {
          toast.error(`Microphone test error: ${e.error}`)
        }
      }

      recognition.onend = () => {
        setIsMicTesting(false)
      }

      testRecognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      setIsMicTesting(false)
      toast.error(`Failed to start microphone test: ${err?.message || err}`)
    }
  }

  const sortedSystemVoices = useMemo(() => {
    return [...systemVoices].sort((a, b) => a.name.localeCompare(b.name))
  }, [systemVoices])

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("voiceAgent.title", "Voice Agent Settings")}
        titleExtra={
          <Badge variant="secondary" className="gap-1 font-mono text-[11px] font-normal opacity-80">
            STT & TTS
          </Badge>
        }
        children={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <Link to="/chat">
                <IconArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">Back to Chat</span>
                <span className="sm:hidden">Chat</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetDefaults} className="h-8 text-xs">
              <IconRefresh className="size-3.5" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-2 sm:p-4 lg:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <Tabs defaultValue="tts" className="w-full">
            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/70 rounded-xl h-11 border border-border/50">
              <TabsTrigger
                value="tts"
                className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium py-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all cursor-pointer"
              >
                <IconVolume className="size-4 shrink-0 text-primary" />
                <span className="truncate">TTS (Voice out)</span>
              </TabsTrigger>
              <TabsTrigger
                value="stt"
                className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium py-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all cursor-pointer"
              >
                <IconMicrophone className="size-4 shrink-0 text-primary" />
                <span className="truncate">STT (Voice in)</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tts" className="mt-4 focus-visible:outline-none">
              {/* Section 1: TTS (Voice out) */}
              <Card className="border-border/80 shadow-xs">
            <CardHeader className="border-border/60 border-b pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                    <IconVolume className="size-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      TTS (Voice out)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Text-to-Speech configuration for reading assistant messages aloud.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-muted-foreground text-xs font-medium">Enable TTS:</span>
                  <Switch
                    checked={settings.tts.enabled}
                    onCheckedChange={(checked) => updateTts("enabled", checked)}
                    aria-label="Enable TTS"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* Engine Selector */}
              <div className="space-y-2">
                <label className="text-foreground text-xs font-semibold">
                  Synthesis Engine
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {/* System Engine Card */}
                  <div
                    onClick={() => updateTts("engine", "system")}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      settings.tts.engine === "system"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                        : "border-border/70 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconVolume className="size-4 text-primary" />
                        <span className="text-xs font-semibold">System Option</span>
                      </div>
                      {settings.tts.engine === "system" && (
                        <IconCheck className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      Native browser Web Speech API. Completely offline, fast response, uses system-installed voices.
                    </p>
                  </div>

                  {/* Edge API Engine Card */}
                  <div
                    onClick={() => updateTts("engine", "edge")}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      settings.tts.engine === "edge"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                        : "border-border/70 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconWorld className="size-4 text-primary" />
                        <span className="text-xs font-semibold">Edge API Option</span>
                      </div>
                      {settings.tts.engine === "edge" && (
                        <IconCheck className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      Microsoft Edge Read Aloud cloud neural voices. Natural human cadence, ultra-realistic tone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Engine Specific Controls */}
              {settings.tts.engine === "system" ? (
                <div className="bg-muted/30 border-border/50 space-y-4 rounded-xl border p-3.5">
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">
                      Select System Voice
                    </label>
                    <Select
                      value={settings.tts.systemVoice}
                      onValueChange={(val) => updateTts("systemVoice", val)}
                    >
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="System Default Voice" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="" className="text-xs">
                          Browser Default
                        </SelectItem>
                        {sortedSystemVoices.map((v) => (
                          <SelectItem key={v.voiceURI} value={v.voiceURI} className="text-xs">
                            {v.name} ({v.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Speed (Rate):</span>
                        <span className="font-mono font-medium">{settings.tts.systemRate}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.tts.systemRate}
                        onChange={(e) => updateTts("systemRate", parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Pitch:</span>
                        <span className="font-mono font-medium">{settings.tts.systemPitch}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={settings.tts.systemPitch}
                        onChange={(e) => updateTts("systemPitch", parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="font-mono font-medium">
                          {Math.round(settings.tts.systemVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.0"
                        step="0.05"
                        value={settings.tts.systemVolume}
                        onChange={(e) => updateTts("systemVolume", parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/30 border-border/50 space-y-4 rounded-xl border p-3.5">
                  <div className="space-y-1.5">
                    <label className="text-foreground text-xs font-medium">
                      Select Microsoft Edge Neural Voice
                    </label>
                    <Select
                      value={settings.tts.edgeVoice}
                      onValueChange={(val) => updateTts("edgeVoice", val)}
                    >
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="Choose Edge Neural Voice" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {EDGE_VOICES.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            <span className="font-medium">{v.name}</span>{" "}
                            <span className="text-muted-foreground font-mono text-[10px]">
                              [{v.lang} • {v.gender}]
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs">Speech Rate:</label>
                      <Select
                        value={settings.tts.edgeRate}
                        onValueChange={(val) => updateTts("edgeRate", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-50%">Very Slow (-50%)</SelectItem>
                          <SelectItem value="-25%">Slow (-25%)</SelectItem>
                          <SelectItem value="+0%">Normal (+0%)</SelectItem>
                          <SelectItem value="+25%">Fast (+25%)</SelectItem>
                          <SelectItem value="+50%">Very Fast (+50%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs">Pitch Adjustment:</label>
                      <Select
                        value={settings.tts.edgePitch}
                        onValueChange={(val) => updateTts("edgePitch", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-30Hz">Lower (-30Hz)</SelectItem>
                          <SelectItem value="-15Hz">Slightly Low (-15Hz)</SelectItem>
                          <SelectItem value="+0Hz">Default (+0Hz)</SelectItem>
                          <SelectItem value="+15Hz">Slightly High (+15Hz)</SelectItem>
                          <SelectItem value="+30Hz">Higher (+30Hz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="font-mono font-medium">
                          {Math.round(settings.tts.edgeVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.0"
                        step="0.05"
                        value={settings.tts.edgeVolume}
                        onChange={(e) => updateTts("edgeVolume", parseFloat(e.target.value))}
                        className="w-full cursor-pointer accent-primary pt-1"
                      />
                    </div>
                  </div>

                  {/* Custom Proxy Endpoint (Optional) */}
                  <div className="space-y-1 pt-1">
                    <label className="text-muted-foreground text-[11px]">
                      Custom Edge Proxy URL (Optional - leave empty for default Bing WebSocket):
                    </label>
                    <Input
                      placeholder="wss://... (Optional custom bridge endpoint)"
                      value={settings.tts.edgeCustomEndpoint || ""}
                      onChange={(e) => updateTts("edgeCustomEndpoint", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Behavior Settings */}
              <div className="border-border/50 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-foreground text-xs font-medium">
                    Auto-read when user used mic
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Automatically read assistant replies aloud only when you asked using microphone voice input.
                  </p>
                </div>
                <Switch
                  checked={settings.tts.autoReadOnMic ?? settings.tts.autoRead ?? false}
                  onCheckedChange={(checked) => {
                    setSettings((prev) => ({
                      ...prev,
                      tts: {
                        ...prev.tts,
                        autoReadOnMic: checked,
                        autoRead: checked,
                      },
                    }))
                  }}
                  aria-label="Auto-read when user used mic"
                />
              </div>

              {/* Test TTS Audio Player */}
              <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-semibold">
                    Test Voice Output
                  </span>
                  {isTtsPlaying && (
                    <Badge variant="default" className="gap-1 text-[10px] bg-emerald-600 animate-pulse">
                      Playing Audio...
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Enter sample text to test voice..."
                    className="h-9 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handlePlaySample}
                    className="h-9 gap-1.5 shrink-0"
                    variant={isTtsPlaying ? "destructive" : "default"}
                  >
                    {isTtsPlaying ? (
                      <>
                        <IconPlayerStop className="size-4" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <IconPlayerPlay className="size-4" />
                        <span>Play Sample</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Card Footer Auto-save Note */}
              <div className="border-border/50 border-t pt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <IconCheck className="size-3.5" />
                  <span>Changes auto-save immediately to your browser.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stt" className="mt-4 focus-visible:outline-none">
          {/* Section 2: STT (Voice in) */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="border-border/60 border-b pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                    <IconMicrophone className="size-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      STT (Voice in)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Speech-to-Text configuration for voice dictation in chat composer.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-muted-foreground text-xs font-medium">Enable STT:</span>
                  <Switch
                    checked={settings.stt.enabled}
                    onCheckedChange={(checked) => updateStt("enabled", checked)}
                    aria-label="Enable STT"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-4">
              {/* Engine Display: System option only */}
              <div className="space-y-2">
                <label className="text-foreground text-xs font-semibold">
                  Input Engine
                </label>
                <div className="border-primary bg-primary/5 ring-1 ring-primary/40 rounded-xl border p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconMicrophone className="size-4 text-primary" />
                      <span className="text-xs font-semibold">System Option</span>
                      <Badge variant="secondary" className="text-[10px]">
                        Default & Only Option
                      </Badge>
                    </div>
                    <IconCheck className="size-4 text-primary" />
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                    Browser native Web Speech Recognition API (SpeechRecognition / webkitSpeechRecognition). Provides low-latency, accurate speech dictation with zero server bandwidth.
                  </p>
                </div>
              </div>

              {/* Language Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-foreground text-xs font-medium">
                    Recognition Language
                  </label>
                  <Select
                    value={settings.stt.language}
                    onValueChange={(val) => updateStt("language", val)}
                  >
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {COMMON_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code || "default"} value={lang.code} className="text-xs">
                          {lang.label} {lang.code && `(${lang.code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-medium">
                    Custom BCP-47 Code
                  </label>
                  <Input
                    placeholder="e.g. en-US, es-ES, zh-CN"
                    value={settings.stt.language}
                    onChange={(e) => updateStt("language", e.target.value.trim())}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-3 divide-y divide-border/40">
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <p className="text-foreground text-xs font-medium">Continuous Dictation</p>
                    <p className="text-muted-foreground text-[11px]">
                      Keep listening across sentence pauses until you explicitly stop microphone.
                    </p>
                  </div>
                  <Switch
                    checked={settings.stt.continuous}
                    onCheckedChange={(checked) => updateStt("continuous", checked)}
                    aria-label="Continuous Dictation"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div className="space-y-0.5">
                    <p className="text-foreground text-xs font-medium">Live Interim Results</p>
                    <p className="text-muted-foreground text-[11px]">
                      Display speech in real-time as words are spoken before full sentence finalization.
                    </p>
                  </div>
                  <Switch
                    checked={settings.stt.interimResults}
                    onCheckedChange={(checked) => updateStt("interimResults", checked)}
                    aria-label="Live Interim Results"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div className="space-y-0.5">
                    <p className="text-foreground text-xs font-medium">Auto-Send After Speech</p>
                    <p className="text-muted-foreground text-[11px]">
                      Automatically send the message when speech recognition finishes detecting audio.
                    </p>
                  </div>
                  <Switch
                    checked={settings.stt.autoSend}
                    onCheckedChange={(checked) => updateStt("autoSend", checked)}
                    aria-label="Auto-Send After Speech"
                  />
                </div>
              </div>

              {/* Test Microphone Box */}
              <div className="border-border/60 bg-card space-y-3 rounded-xl border p-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-semibold">
                    Test Speech Recognition
                  </span>
                  {isMicTesting && (
                    <Badge variant="destructive" className="gap-1 text-[10px] animate-pulse">
                      <span className="size-1.5 rounded-full bg-white animate-ping" />
                      Listening to Microphone
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleToggleMicTest}
                    variant={isMicTesting ? "destructive" : "default"}
                    className="h-9 gap-1.5 shrink-0"
                  >
                    {isMicTesting ? (
                      <>
                        <IconMicrophoneOff className="size-4" />
                        <span>Stop Mic Test</span>
                      </>
                    ) : (
                      <>
                        <IconMicrophone className="size-4" />
                        <span>Test Microphone</span>
                      </>
                    )}
                  </Button>
                  <p className="text-muted-foreground text-[11px]">
                    Click to test your microphone and verify transcription in real-time.
                  </p>
                </div>

                {testTranscript && (
                  <div className="border-border/50 bg-muted/40 rounded-lg border p-2.5 text-xs text-foreground font-mono">
                    <span className="text-muted-foreground font-sans text-[10px] block mb-1">
                      Transcript Output:
                    </span>
                    {testTranscript}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</div>
  )
}
