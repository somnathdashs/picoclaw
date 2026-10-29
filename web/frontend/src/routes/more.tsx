import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/more")({
  component: () => <Navigate to="/models" />,
})
