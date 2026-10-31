import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconMicrophone,
  IconVolume,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EDGE_VOICES, voiceAgentSettingsAtom } from "@/store/voice-agent"

export function VoiceAgentSection() {
  const { t } = useTranslation()
  const settings = useAtomValue(voiceAgentSettingsAtom)

  const activeEdgeVoice = EDGE_VOICES.find(
    (v) => v.id === settings.tts.edgeVoice,
  )

  return (
    <Card size="sm" className="border-border/80 shadow-xs">
      <CardHeader className="border-border/60 border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg">
                <IconMicrophone className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">
                {t("voiceAgent.sectionTitle", "Voice Agent")}
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-medium">
                Client-side
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t(
                "voiceAgent.sectionDesc",
                "Configure Speech-to-Text (STT) voice input and Text-to-Speech (TTS) voice output engines for your chat experience.",
              )}
            </CardDescription>
          </div>

          <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
            <Link to="/settings">
              <IconAdjustmentsHorizontal className="size-3.5" />
              <span>{t("voiceAgent.configureButton", "Configure Voice Agent")}</span>
              <IconArrowRight className="size-3 opacity-70" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* STT Status Card */}
          <div className="border-border/50 bg-muted/30 flex flex-col justify-between rounded-xl border p-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <IconMicrophone className="text-primary size-3.5" />
                  <span>STT (Voice in)</span>
                </span>
                <Badge
                  variant={settings.stt.enabled ? "default" : "outline"}
                  className="text-[10px] py-0 px-1.5"
                >
                  {settings.stt.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="text-muted-foreground space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-foreground font-medium">System (Web Speech API)</span>
                </div>
                <div className="flex justify-between">
                  <span>Language:</span>
                  <span className="text-foreground font-medium">
                    {settings.stt.language || "Browser Default"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Send:</span>
                  <span className="text-foreground font-medium">
                    {settings.stt.autoSend ? "Active" : "Off"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TTS Status Card */}
          <div className="border-border/50 bg-muted/30 flex flex-col justify-between rounded-xl border p-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <IconVolume className="text-primary size-3.5" />
                  <span>TTS (Voice out)</span>
                </span>
                <Badge
                  variant={settings.tts.enabled ? "default" : "outline"}
                  className="text-[10px] py-0 px-1.5"
                >
                  {settings.tts.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="text-muted-foreground space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-foreground font-medium capitalize">
                    {settings.tts.engine === "edge" ? "Edge API (Cloud Neural)" : "System (Native)"}
                  </span>
                </div>
                <div className="flex justify-between truncate">
                  <span>Voice:</span>
                  <span className="text-foreground max-w-[140px] truncate font-medium">
                    {settings.tts.engine === "edge"
                      ? activeEdgeVoice?.name || settings.tts.edgeVoice
                      : settings.tts.systemVoice || "System Default"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Read on Mic:</span>
                  <span className="text-foreground font-medium">
                    {(settings.tts.autoReadOnMic ?? settings.tts.autoRead) ? "Enabled" : "Manual Click"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
