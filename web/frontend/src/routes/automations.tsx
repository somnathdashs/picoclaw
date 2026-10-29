import { createFileRoute } from "@tanstack/react-router"

import { AutomationPage } from "@/components/automations/automation-page"

export const Route = createFileRoute("/automations")({
  component: AutomationPage,
})
