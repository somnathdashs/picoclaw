import { useCallback, useEffect, useState } from "react"

export type ThemeType = "light" | "dark"

export interface ThemeDefinition {
  id: string
  name: string
  type: ThemeType
  primary: string
  bg: string
  accent: string
  description: string
}

export const AVAILABLE_THEMES: ThemeDefinition[] = [
  // Light Themes
  {
    id: "pure-light",
    name: "Pure Light",
    type: "light",
    primary: "#18181b",
    bg: "#ffffff",
    accent: "#8b5cf6",
    description: "Crisp modern light",
  },
  {
    id: "slate-cool",
    name: "Slate Mist",
    type: "light",
    primary: "#0284c7",
    bg: "#f1f5f9",
    accent: "#38bdf8",
    description: "Cool slate and cyan",
  },
  {
    id: "warm-sand",
    name: "Warm Sand",
    type: "light",
    primary: "#b45309",
    bg: "#fefce8",
    accent: "#f59e0b",
    description: "Amber parchment tones",
  },
  {
    id: "rose-pastel",
    name: "Rose Pastel",
    type: "light",
    primary: "#e11d48",
    bg: "#fff1f2",
    accent: "#fb7185",
    description: "Soft blush and ruby",
  },

  // Dark Themes
  {
    id: "obsidian-dark",
    name: "Obsidian Dark",
    type: "dark",
    primary: "#a855f7",
    bg: "#09090b",
    accent: "#c084fc",
    description: "Deep neutral zinc",
  },
  {
    id: "midnight-navy",
    name: "Midnight Navy",
    type: "dark",
    primary: "#38bdf8",
    bg: "#030712",
    accent: "#0ea5e9",
    description: "Deep oceanic blue",
  },
  {
    id: "dracula-violet",
    name: "Dracula Violet",
    type: "dark",
    primary: "#d946ef",
    bg: "#0c051f",
    accent: "#a855f7",
    description: "Neon purple aesthetic",
  },
  {
    id: "cyber-emerald",
    name: "Cyber Emerald",
    type: "dark",
    primary: "#10b981",
    bg: "#022c22",
    accent: "#34d399",
    description: "Matrix neon green",
  },
]

function getInitialThemeId(): string {
  if (typeof window === "undefined") return "obsidian-dark"
  const storedThemeId = localStorage.getItem("app_theme_id")
  if (storedThemeId && AVAILABLE_THEMES.some((t) => t.id === storedThemeId)) {
    return storedThemeId
  }
  const oldTheme = localStorage.getItem("theme")
  return oldTheme === "light" ? "pure-light" : "obsidian-dark"
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState<string>(getInitialThemeId)

  const activeTheme =
    AVAILABLE_THEMES.find((t) => t.id === themeId) || AVAILABLE_THEMES[4]
  const theme: ThemeType = activeTheme.type

  const applyTheme = useCallback((targetTheme: ThemeDefinition) => {
    const root = document.documentElement
    if (targetTheme.type === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    root.setAttribute("data-theme", targetTheme.id)
    localStorage.setItem("theme", targetTheme.type)
    localStorage.setItem("app_theme_id", targetTheme.id)
  }, [])

  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme, applyTheme])

  const setTheme = useCallback(
    (newThemeId: string) => {
      const match = AVAILABLE_THEMES.find((t) => t.id === newThemeId)
      if (match) {
        setThemeIdState(match.id)
        applyTheme(match)
      }
    },
    [applyTheme],
  )

  const toggleTheme = useCallback(() => {
    setThemeIdState((prevId) => {
      const current =
        AVAILABLE_THEMES.find((t) => t.id === prevId) || AVAILABLE_THEMES[4]
      const nextId = current.type === "dark" ? "pure-light" : "obsidian-dark"
      return nextId
    })
  }, [])

  return {
    theme,
    themeId,
    activeTheme,
    setTheme,
    toggleTheme,
    availableThemes: AVAILABLE_THEMES,
  }
}
