import { createFileRoute } from "@tanstack/react-router"

import { VoiceAgentPage } from "@/components/voice/voice-agent-page"

export const Route = createFileRoute("/settings")({
  component: VoiceAgentPage,
})
