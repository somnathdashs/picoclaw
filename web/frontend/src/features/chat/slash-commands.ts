export interface SlashCommand {
  name: string
  command: string
  args?: string
  description: string
  category: "General" | "Chat" | "Config" | "Tools" | "Agents" | "Skills" | "Status" | "System"
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "start",
    command: "/start",
    description: "Start the bot",
    category: "General",
  },
  {
    name: "help",
    command: "/help",
    description: "Show available commands and usage",
    category: "General",
  },
  {
    name: "stop",
    command: "/stop",
    description: "Stop the current active task",
    category: "System",
  },
  {
    name: "clear",
    command: "/clear",
    description: "Clear the chat history",
    category: "Chat",
  },
  {
    name: "context",
    command: "/context",
    description: "Show session context and token usage",
    category: "Status",
  },
  {
    name: "btw",
    command: "/btw",
    args: "<question>",
    description: "Ask a side question without changing history",
    category: "Chat",
  },
  {
    name: "show model",
    command: "/show model",
    description: "Current model and provider",
    category: "Config",
  },
  {
    name: "show channel",
    command: "/show channel",
    description: "Current active channel",
    category: "Config",
  },
  {
    name: "show agents",
    command: "/show agents",
    description: "List registered agents",
    category: "Agents",
  },
  {
    name: "show mcp",
    command: "/show mcp",
    args: "<server>",
    description: "Active tools for an MCP server",
    category: "Tools",
  },
  {
    name: "list models",
    command: "/list models",
    description: "List configured models",
    category: "Config",
  },
  {
    name: "list channels",
    command: "/list channels",
    description: "List enabled channels",
    category: "Config",
  },
  {
    name: "list agents",
    command: "/list agents",
    description: "List registered agents",
    category: "Agents",
  },
  {
    name: "list skills",
    command: "/list skills",
    description: "List installed skills",
    category: "Skills",
  },
  {
    name: "list mcp",
    command: "/list mcp",
    description: "List configured MCP servers",
    category: "Tools",
  },
  {
    name: "switch model",
    command: "/switch model to",
    args: "<name>",
    description: "Switch to a different model",
    category: "Config",
  },
  {
    name: "use",
    command: "/use",
    args: "<skill> [message]",
    description: "Force an installed skill for one request",
    category: "Skills",
  },
  {
    name: "check channel",
    command: "/check channel",
    args: "<name>",
    description: "Check if a channel is available",
    category: "System",
  },
  {
    name: "reload",
    command: "/reload",
    description: "Reload the configuration file",
    category: "System",
  },
  {
    name: "subagents",
    command: "/subagents",
    description: "Show running subagents and task tree",
    category: "Agents",
  },
]

export function filterSlashCommands(query: string): SlashCommand[] {
  const clean = query.trim().toLowerCase().replace(/^\//, "")
  if (!clean) return SLASH_COMMANDS

  return SLASH_COMMANDS.filter((cmd) => {
    const rawCmd = cmd.command.toLowerCase().replace(/^\//, "")
    const nameMatch = cmd.name.toLowerCase().includes(clean)
    const cmdMatch = rawCmd.includes(clean)
    const descMatch = cmd.description.toLowerCase().includes(clean)
    return nameMatch || cmdMatch || descMatch
  })
}
