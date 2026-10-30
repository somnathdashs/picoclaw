export interface SkillSuggestion {
  name: string
  trigger: string
  description: string
}

export const DEFAULT_SKILLS: SkillSuggestion[] = [
  {
    name: "agent-browser",
    trigger: "#agent-browser",
    description: "Browser automation and web navigation",
  },
  {
    name: "weather",
    trigger: "#weather",
    description: "Get real-time weather and forecasts",
  },
  {
    name: "github",
    trigger: "#github",
    description: "GitHub repositories, issues, and pull requests",
  },
  {
    name: "summarize",
    trigger: "#summarize",
    description: "Summarize long documents and text content",
  },
  {
    name: "tmux",
    trigger: "#tmux",
    description: "Manage terminal multiplexer sessions and windows",
  },
  {
    name: "skill-creator",
    trigger: "#skill-creator",
    description: "Create, test, and package new agent skills",
  },
  {
    name: "hardware",
    trigger: "#hardware",
    description: "Inspect hardware devices, CPU, and memory",
  },
  {
    name: "system-health-check",
    trigger: "#system-health-check",
    description: "Run diagnostic health checks on the system",
  },
  {
    name: "communication-channel-status",
    trigger: "#communication-channel-status",
    description: "Check status of messaging and chat channels",
  },
  {
    name: "my-play-music-from-yt",
    trigger: "#my-play-music-from-yt",
    description: "Search and stream music audio from YouTube",
  },
  {
    name: "play-music",
    trigger: "#play-music",
    description: "Audio and music playback controls",
  },
  {
    name: "general-conversations",
    trigger: "#general-conversations",
    description: "Conversational dialogue and assistance",
  },
  {
    name: "picoclaw-agent",
    trigger: "#picoclaw-agent",
    description: "PicoClaw agent instructions and control",
  },
  {
    name: "prime-number-calculator",
    trigger: "#prime-number-calculator",
    description: "Calculate prime numbers and prime factors",
  },
  {
    name: "build-a-python-gui-bases",
    trigger: "#build-a-python-gui-bases",
    description: "Scaffold Python GUI applications",
  },
  {
    name: "can-you-build-a-astro",
    trigger: "#can-you-build-a-astro",
    description: "Astro framework project starter and guide",
  },
  {
    name: "explain-me-law-of-thermodynamic",
    trigger: "#explain-me-law-of-thermodynamic",
    description: "Physics laws of thermodynamics explanations",
  },
  {
    name: "homeopathy-ecommerce-site",
    trigger: "#homeopathy-ecommerce-site",
    description: "Homeopathy eCommerce storefront reference",
  },
]

export function filterSkills(
  skills: SkillSuggestion[],
  query: string,
): SkillSuggestion[] {
  const clean = query.trim().toLowerCase().replace(/^#/, "")
  if (!clean) return skills

  return skills.filter((item) => {
    const nameMatch = item.name.toLowerCase().includes(clean)
    const descMatch = item.description.toLowerCase().includes(clean)
    return nameMatch || descMatch
  })
}
