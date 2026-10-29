import { IconCheck, IconMoon, IconPalette, IconSun } from "@tabler/icons-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { type ThemeDefinition, useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

interface ThemeSelectorProps {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "end" | "center"
}

export function ThemeSelector({
  side = "top",
  align = "end",
}: ThemeSelectorProps = {}) {
  const { themeId, activeTheme, setTheme, availableThemes } = useTheme()
  const [open, setOpen] = useState(false)

  const lightThemes = availableThemes.filter((t) => t.type === "light")
  const darkThemes = availableThemes.filter((t) => t.type === "dark")

  const renderThemeCard = (item: ThemeDefinition) => {
    const isSelected = item.id === themeId

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setTheme(item.id)}
        className={cn(
          "group relative flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-200",
          isSelected
            ? "border-primary bg-primary/10 ring-primary/30 shadow-xs ring-1"
            : "border-border/40 hover:border-border hover:bg-muted/50",
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* Swatch preview dots */}
          <div className="flex shrink-0 items-center -space-x-1">
            <span
              className="size-4 rounded-full border border-black/10 shadow-2xs dark:border-white/10"
              style={{ backgroundColor: item.bg }}
            />
            <span
              className="size-4 rounded-full border border-black/10 shadow-2xs dark:border-white/10"
              style={{ backgroundColor: item.primary }}
            />
            <span
              className="size-3.5 rounded-full border border-black/10 shadow-2xs dark:border-white/10"
              style={{ backgroundColor: item.accent }}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground text-xs font-medium">
                {item.name}
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-1 text-[10px]">
              {item.description}
            </p>
          </div>
        </div>

        {isSelected && (
          <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
            <IconCheck className="size-3 stroke-[3]" />
          </span>
        )}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label="Theme selector"
          title={`Current theme: ${activeTheme.name}`}
        >
          {activeTheme.type === "dark" ? (
            <IconMoon className="text-foreground size-4.5" />
          ) : (
            <IconSun className="text-foreground size-4.5" />
          )}
          <span
            className="ring-background absolute right-1 bottom-1 size-1.5 rounded-full ring-1"
            style={{ backgroundColor: activeTheme.primary }}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className="border-border/60 bg-popover/95 w-80 space-y-3 rounded-2xl p-3 shadow-xl backdrop-blur-xl"
      >
        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <IconPalette className="text-primary size-4" />
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Color Themes
            </span>
          </div>
          <span className="text-foreground bg-muted border-border/50 rounded-full border px-2 py-0.5 text-[11px] font-medium">
            {activeTheme.name}
          </span>
        </div>

        {/* Light Themes Section */}
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-semibold">
            <IconSun className="size-3.5 text-amber-500" />
            <span>Light Themes</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {lightThemes.map(renderThemeCard)}
          </div>
        </div>

        {/* Dark Themes Section */}
        <div className="border-border/30 space-y-1.5 border-t pt-1">
          <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-semibold">
            <IconMoon className="size-3.5 text-indigo-400" />
            <span>Dark Themes</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {darkThemes.map(renderThemeCard)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
