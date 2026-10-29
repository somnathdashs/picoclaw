import { createFileRoute } from "@tanstack/react-router"

import { ChatHistoryPage } from "@/components/chat/chat-history-page"

export const Route = createFileRoute("/chat-history")({
  component: ChatHistoryPage,
})
