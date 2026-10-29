import {
  IconClock,
  IconDeviceFloppy,
  IconEye,
  IconFileCode,
  IconFileText,
  IconScale,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import dayjs from "dayjs"
import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

import { getRules, resetRules, updateRules } from "@/api/rules"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const DEFAULT_RULES_TEMPLATE = `# Global Model Rules

## Response Style
- Be concise, direct, and accurate.
- Avoid unnecessary preambles or generic pleasantries.
- Provide clean, complete code when requested with minimal comments.

## Interaction Principles
- Adhere strictly to user instructions and safety bounds.
- If requirements are ambiguous, clarify before executing destructive tasks.
- Keep output neatly formatted in GitHub-flavored Markdown.
`

interface RulesPanelProps {
  onClose: () => void
}

export function RulesPanel({ onClose }: RulesPanelProps) {
  const [content, setContent] = useState("")
  const [initialContent, setInitialContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit")
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined)
  const [fileExists, setFileExists] = useState(false)

  const isDirty = useMemo(() => content !== initialContent, [content, initialContent])

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRules()
      setContent(res.content || "")
      setInitialContent(res.content || "")
      setFileExists(res.exists)
      setUpdatedAt(res.updated_at)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load rules")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateRules(content)
      setInitialContent(res.content)
      setFileExists(true)
      setUpdatedAt(res.updated_at)
      toast.success("Model rules saved to RULES.md")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rules")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setContent("")
  }

  const handleInsertTemplate = () => {
    setContent((prev) => (prev.trim() ? `${prev}\n\n${DEFAULT_RULES_TEMPLATE}` : DEFAULT_RULES_TEMPLATE))
    toast.info("Rule template inserted")
  }

  const handleResetFile = async () => {
    if (!confirm("Are you sure you want to reset RULES.md to an empty file?")) {
      return
    }
    setSaving(true)
    try {
      await resetRules()
      setContent("")
      setInitialContent("")
      setFileExists(false)
      setUpdatedAt(undefined)
      toast.success("RULES.md has been reset to empty")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset rules")
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      if (!saving) {
        handleSave()
      }
    }
  }

  return (
    <aside className="w-full md:w-84 lg:w-96 xl:w-[420px] shrink-0 border-l border-border bg-card/70 backdrop-blur-md flex flex-col h-full z-20 absolute inset-0 md:static transition-all duration-200 shadow-xl md:shadow-none animate-in fade-in slide-in-from-right-4">
      {/* Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IconScale className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-semibold truncate text-foreground">
                Model Rules
              </h2>
              <Badge
                variant="outline"
                className="font-mono text-[9px] px-1 py-0 tracking-wide border-primary/30 text-primary bg-primary/5 shrink-0"
              >
                RULES.md
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
              <span>Global prompt guidelines for model</span>
              {updatedAt ? (
                <span className="flex items-center gap-0.5 text-[10px]">
                  • <IconClock className="size-2.5 inline" /> {dayjs(updatedAt * 1000).format("MMM D, HH:mm")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="size-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
          title="Close rules panel"
          aria-label="Close rules panel"
        >
          <IconX className="size-4" />
        </Button>
      </div>

      {/* Editor & Preview Area */}
      <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex items-center justify-between gap-1.5 pb-2.5 flex-wrap">
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="edit" className="text-[11px] px-2.5 h-6 gap-1">
                <IconFileCode className="size-3" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-[11px] px-2.5 h-6 gap-1">
                <IconEye className="size-3" />
                Preview
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleInsertTemplate}
                className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                title="Insert starter template"
              >
                <IconSparkles className="size-3 text-amber-500" />
                <span>Template</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!content}
                className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-destructive"
                title="Clear text"
              >
                <IconTrash className="size-3" />
                <span>Clear</span>
              </Button>
            </div>
          </div>

          <TabsContent value="edit" className="flex-1 min-h-0 mt-0 flex flex-col">
            <div className="relative flex-1 min-h-0 flex flex-col rounded-lg border border-border/80 bg-background/80 focus-within:ring-1 focus-within:ring-primary/40">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`# Global Model Rules\n\nWrite custom rules in Markdown format.\n\nIf left empty, no custom rules are added to prompt.`}
                className="flex-1 min-h-[220px] resize-none border-0 p-2.5 sm:p-3 font-mono text-xs leading-relaxed bg-transparent focus-visible:ring-0 shadow-none"
                disabled={loading || saving}
              />
              <div className="p-1.5 px-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{content.length} chars • {content.split("\n").length} lines</span>
                <span className="hidden sm:inline font-mono text-[9px]">Ctrl+S to save</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 min-h-0 mt-0 overflow-y-auto rounded-lg border border-border/80 bg-muted/10 p-3 sm:p-4">
            {content.trim() ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs space-y-2">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                <IconFileText className="size-7 mb-2 opacity-35" />
                <p className="text-xs font-medium">Empty rules file</p>
                <p className="text-[10px] mt-0.5 text-muted-foreground/80">
                  Click Template above or type rules in the Edit tab.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Footer */}
      <div className="p-3 sm:p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between gap-2">
        {fileExists ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFile}
            disabled={saving || loading}
            className="text-[11px] text-muted-foreground hover:text-destructive h-7 px-2"
          >
            Reset
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-7.5 px-2.5"
          >
            Close
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="text-xs h-7.5 gap-1.5 font-medium px-3.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <IconDeviceFloppy className="size-3.5" />
            {saving ? "Saving..." : isDirty ? "Save Rules *" : "Save Rules"}
          </Button>
        </div>
      </div>
    </aside>
  )
}
