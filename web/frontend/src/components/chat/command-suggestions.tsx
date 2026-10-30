import { useEffect, useRef } from "react"

import { type SlashCommand } from "@/features/chat/slash-commands"
import { cn } from "@/lib/utils"

interface CommandSuggestionsProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
}

export function CommandSuggestions({
  commands,
  selectedIndex,
  onSelect,
}: CommandSuggestionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex]
    if (selectedElement && containerRef.current) {
      selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex])

  if (commands.length === 0) return null

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Commands"
      className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-56 sm:max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 p-1 shadow-lg backdrop-blur-sm"
    >
      {commands.map((cmd, idx) => {
        const isSelected = idx === selectedIndex

        return (
          <button
            key={cmd.command}
            ref={(el) => {
              itemRefs.current[idx] = el
            }}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd)
            }}
            className={cn(
              "group flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
              isSelected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <span className="shrink-0 font-medium text-foreground">
              {cmd.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {cmd.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
