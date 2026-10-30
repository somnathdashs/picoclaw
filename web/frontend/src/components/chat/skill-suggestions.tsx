import { useEffect, useRef } from "react"

import { type SkillSuggestion } from "@/features/chat/skill-suggestions"
import { cn } from "@/lib/utils"

interface SkillSuggestionsProps {
  skills: SkillSuggestion[]
  selectedIndex: number
  onSelect: (skill: SkillSuggestion) => void
}

export function SkillSuggestions({
  skills,
  selectedIndex,
  onSelect,
}: SkillSuggestionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex]
    if (selectedElement && containerRef.current) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex])

  if (skills.length === 0) return null

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Skills"
      className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-56 sm:max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 p-1 shadow-lg backdrop-blur-sm"
    >
      {skills.map((skill, idx) => {
        const isSelected = idx === selectedIndex

        return (
          <button
            key={skill.name}
            ref={(el) => {
              itemRefs.current[idx] = el
            }}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(skill)
            }}
            className={cn(
              "group flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
              isSelected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <span className="shrink-0 font-medium text-foreground">
              {skill.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {skill.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
