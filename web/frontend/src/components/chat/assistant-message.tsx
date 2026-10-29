import {
  IconAlertCircle,
  IconBrain,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFileText,
  IconFolder,
  IconHelpCircle,
  IconLoader2,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSparkles,
  IconTerminal2,
  IconTool,
  IconVolume,
  IconVolumeOff,
  IconWorld,
} from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  MarkdownCodeBlock,
  MessageCodeBlock,
} from "@/components/chat/message-code-block"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { formatMessageTime } from "@/hooks/use-pico-chat"
import { cn } from "@/lib/utils"
import {
  type AssistantMessageKind,
  type ChatAttachment,
  type ChatToolCall,
} from "@/store/chat"

function getToolIcon(name: string) {
  const n = name.toLowerCase()
  if (
    n.includes("command") ||
    n.includes("exec") ||
    n.includes("terminal") ||
    n.includes("bash") ||
    n.includes("sh")
  ) {
    return IconTerminal2
  }
  if (n.includes("view") || n.includes("read") || n.includes("cat")) {
    return IconFileText
  }
  if (
    n.includes("edit") ||
    n.includes("replace") ||
    n.includes("write") ||
    n.includes("patch")
  ) {
    return IconEdit
  }
  if (
    n.includes("search") ||
    n.includes("web") ||
    n.includes("browse") ||
    n.includes("url") ||
    n.includes("fetch")
  ) {
    return IconWorld
  }
  if (
    n.includes("dir") ||
    n.includes("list") ||
    n.includes("ls") ||
    n.includes("folder")
  ) {
    return IconFolder
  }
  if (n.includes("grep") || n.includes("find")) {
    return IconSearch
  }
  if (n.includes("subagent") || n.includes("agent") || n.includes("task")) {
    return IconRobot
  }
  if (n.includes("ask") || n.includes("question")) {
    return IconHelpCircle
  }
  if (n.includes("cron") || n.includes("schedule")) {
    return IconClock
  }
  return IconTool
}

function parseToolArgs(argsStr?: string): Record<string, unknown> | null {
  if (!argsStr) return null
  try {
    const parsed = JSON.parse(argsStr)
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

function formatToolActionName(
  name: string,
  args: Record<string, unknown> | null,
  isExecuting: boolean,
): string {
  if (args && typeof args.toolAction === "string" && args.toolAction.trim()) {
    const action = args.toolAction.trim()
    return isExecuting && !action.endsWith("…") && !action.endsWith("...")
      ? `${action}…`
      : action
  }
  const n = name.toLowerCase()
  if (n.includes("search_web") || n.includes("web_search")) {
    return isExecuting ? "Searching the web…" : "Searched the web"
  }
  if (n.includes("run_command") || n.includes("exec") || n.includes("bash")) {
    return isExecuting ? "Running command…" : "Ran command"
  }
  if (n.includes("view_file") || n.includes("read_file")) {
    return isExecuting ? "Viewing file…" : "Viewed file"
  }
  if (
    n.includes("replace_file_content") ||
    n.includes("edit_file") ||
    n.includes("write_file")
  ) {
    return isExecuting ? "Editing file…" : "Edited file"
  }
  if (n.includes("list_dir") || n.includes("list_files")) {
    return isExecuting ? "Analyzing directory…" : "Analyzed directory"
  }
  if (n.includes("grep_search")) {
    return isExecuting ? "Searching code…" : "Searched code"
  }
  if (n.includes("ask_question")) {
    return isExecuting ? "Asking questions…" : "Asked questions"
  }
  const clean = name.replace(/_/g, " ").trim()
  if (!clean) return isExecuting ? "Executing tool…" : "Tool executed"
  const title = clean
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
  return isExecuting ? `Executing ${title}…` : `Executed ${title}`
}

function getToolTargetSnippet(args: Record<string, unknown> | null): string | null {
  if (!args) return null
  if (typeof args.toolSummary === "string" && args.toolSummary.trim()) {
    return args.toolSummary.trim()
  }
  if (typeof args.CommandLine === "string" && args.CommandLine.trim()) {
    return `$ ${args.CommandLine.trim()}`
  }
  if (typeof args.command === "string" && args.command.trim()) {
    return `$ ${args.command.trim()}`
  }
  if (typeof args.TargetFile === "string" && args.TargetFile.trim()) {
    return args.TargetFile.replace(/\\/g, "/").split("/").pop() ?? args.TargetFile
  }
  if (typeof args.AbsolutePath === "string" && args.AbsolutePath.trim()) {
    return (
      args.AbsolutePath.replace(/\\/g, "/").split("/").pop() ??
      args.AbsolutePath
    )
  }
  if (typeof args.path === "string" && args.path.trim()) {
    return args.path.replace(/\\/g, "/").split("/").pop() ?? args.path
  }
  if (typeof args.query === "string" && args.query.trim()) {
    return `"${args.query.trim()}"`
  }
  if (typeof args.Url === "string" && args.Url.trim()) {
    return args.Url.trim()
  }
  if (typeof args.url === "string" && args.url.trim()) {
    return args.url.trim()
  }
  return null
}

function extractDiff(
  args: Record<string, unknown> | null,
  toolCall?: ChatToolCall,
  toolName?: string,
): {
  added: number
  removed: number
} {
  let added = 0
  let removed = 0

  const rawReturn =
    toolCall?.result ??
    toolCall?.output ??
    (toolCall as Record<string, unknown>)?.response ??
    toolCall?.extraContent?.result ??
    toolCall?.extraContent?.output ??
    (toolCall as Record<string, unknown>)?.content

  if (
    typeof rawReturn === "string" &&
    (rawReturn.includes("@@") ||
      rawReturn.includes("```diff") ||
      rawReturn.includes("--- a/") ||
      rawReturn.includes("+++ b/"))
  ) {
    const lines = rawReturn.split("\n")
    let inDiff = false
    for (const line of lines) {
      if (line.startsWith("```diff")) {
        inDiff = true
        continue
      }
      if (inDiff && line.startsWith("```")) {
        inDiff = false
        continue
      }
      if (inDiff || rawReturn.includes("@@") || rawReturn.includes("--- a/")) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          added++
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          removed++
        }
      }
    }
    if (added > 0 || removed > 0) {
      return { added, removed }
    }
  }

  if (!args) return { added: 0, removed: 0 }

  if (
    typeof args.TargetContent === "string" &&
    typeof args.ReplacementContent === "string"
  ) {
    added += args.ReplacementContent.split("\n").length
    removed += args.TargetContent.split("\n").length
  }

  if (Array.isArray(args.ReplacementChunks)) {
    for (const chunk of args.ReplacementChunks) {
      if (chunk && typeof chunk === "object") {
        const c = chunk as Record<string, unknown>
        if (typeof c.TargetContent === "string") {
          removed += c.TargetContent.split("\n").length
        }
        if (typeof c.ReplacementContent === "string") {
          added += c.ReplacementContent.split("\n").length
        }
      }
    }
  }

  if (
    typeof args.old_text === "string" &&
    typeof args.new_text === "string"
  ) {
    removed += args.old_text.split("\n").length
    added += args.new_text.split("\n").length
  }

  const content =
    typeof args.CodeContent === "string"
      ? args.CodeContent
      : typeof args.content === "string"
        ? args.content
        : typeof args.code === "string"
          ? args.code
          : typeof args.append_content === "string"
            ? args.append_content
            : typeof args.text === "string"
              ? args.text
              : null

  if (content !== null && added === 0 && removed === 0) {
    const n = (toolName || "").toLowerCase()
    if (
      n.includes("write") ||
      n.includes("create") ||
      n.includes("append") ||
      n.includes("save") ||
      n.includes("edit")
    ) {
      added += content.split("\n").length
    }
  }

  return { added, removed }
}

function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 3.8)
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

function getToolReturnDisplay(
  toolCall: ChatToolCall,
  toolName: string,
  parsedArgs: Record<string, unknown> | null,
  isExecuting: boolean,
): { content: string; language: string } {
  const raw =
    toolCall.result ??
    toolCall.output ??
    (toolCall as Record<string, unknown>).response ??
    toolCall.extraContent?.result ??
    toolCall.extraContent?.output ??
    (toolCall as Record<string, unknown>).content

  let text = ""
  if (typeof raw === "string") {
    text = raw.trim()
  } else if (raw !== undefined && raw !== null) {
    try {
      text = JSON.stringify(raw, null, 2)
    } catch {
      text = String(raw)
    }
  }

  if (text && (text.startsWith("{") || text.startsWith("["))) {
    try {
      const parsed = JSON.parse(text)
      text = JSON.stringify(parsed, null, 2)
    } catch {
      // keep original text
    }
  }

  const isGenericSuccess =
    !text ||
    text.toLowerCase() === "success" ||
    text.toLowerCase() === "success (no return output)" ||
    text === "{}" ||
    text === "[]"

  if (isGenericSuccess) {
    const n = toolName.toLowerCase()
    const query =
      typeof parsedArgs?.query === "string"
        ? parsedArgs.query.trim()
        : typeof parsedArgs?.q === "string"
          ? parsedArgs.q.trim()
          : ""
    const target = getToolTargetSnippet(parsedArgs)

    if (isExecuting) {
      if (n.includes("search_web") || n.includes("web_search")) {
        text = query ? `Searching the web for "${query}"…` : "Searching the web…"
      } else {
        text = `Executing ${toolName}…`
      }
    } else {
      if (n.includes("search_web") || n.includes("web_search")) {
        text = query
          ? `Web search completed for: "${query}"\nResults processed and incorporated into response.`
          : "Web search completed successfully. Results processed and incorporated into response."
      } else if (n.includes("run_command") || n.includes("exec")) {
        text = target
          ? `Command ${target} completed successfully with exit code 0.`
          : "Command completed successfully with exit code 0."
      } else if (n.includes("view_file") || n.includes("read_file")) {
        text = target ? `Read ${target} successfully.` : "File read successfully."
      } else if (
        n.includes("replace_file_content") ||
        n.includes("edit_file") ||
        n.includes("write_to_file")
      ) {
        text = target ? `Successfully updated ${target}.` : "File updated successfully."
      } else if (n.includes("list_dir")) {
        text = target
          ? `Directory listing completed for ${target}.`
          : "Directory listing completed."
      } else {
        text = `${toolName} completed successfully.`
      }
    }
  }

  const isJson = text.trim().startsWith("{") || text.trim().startsWith("[")
  return {
    content: text,
    language: isJson ? "json" : "markdown",
  }
}

function ToolRowItem({
  toolCall,
  isStreaming,
  isLast,
}: {
  toolCall: ChatToolCall
  isStreaming: boolean
  isLast: boolean
}) {
  const isExecuting = isStreaming && isLast
  const [isOpen, setIsOpen] = useState(() => isExecuting)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const prevExecutingRef = useRef(isExecuting)

  useEffect(() => {
    if (isExecuting) {
      setIsOpen(true)
    } else if (prevExecutingRef.current && !isExecuting) {
      setIsOpen(false)
    }
    prevExecutingRef.current = isExecuting
  }, [isExecuting])

  const toolName = toolCall.function?.name?.trim() ?? "tool"
  const toolArgsRaw = toolCall.function?.arguments?.trim() ?? ""
  const explanation =
    toolCall.extraContent?.toolFeedbackExplanation?.trim() ?? ""
  const parsedArgs = parseToolArgs(toolArgsRaw)

  const { content: returnContent, language: returnLanguage } = getToolReturnDisplay(
    toolCall,
    toolName,
    parsedArgs,
    isExecuting,
  )

  const ToolIcon = getToolIcon(toolName)
  const actionLabel = formatToolActionName(toolName, parsedArgs, isExecuting)
  const targetSnippet = getToolTargetSnippet(parsedArgs)
  const diff = extractDiff(parsedArgs, toolCall, toolName)

  return (
    <div className="rounded-lg transition-colors hover:bg-muted/40">
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExecuting ? (
            <IconLoader2 className="size-3.5 animate-spin text-primary shrink-0" />
          ) : (
            <IconCheck className="size-3.5 text-emerald-500 shrink-0" />
          )}
          <ToolIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">
            {actionLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {targetSnippet && (
            <span className="hidden sm:inline-block max-w-[160px] md:max-w-[220px] font-mono text-[11px] text-muted-foreground/75 truncate text-right">
              {targetSnippet}
            </span>
          )}
          {(diff.added > 0 || diff.removed > 0) && (
            <span className="flex items-center gap-1 font-mono text-[11px] font-bold">
              {diff.added > 0 && (
                <span className="text-emerald-500 font-semibold">+{diff.added}</span>
              )}
              {diff.removed > 0 && (
                <span className="text-rose-500 font-semibold">-{diff.removed}</span>
              )}
            </span>
          )}
          <IconChevronRight
            className={cn(
              "size-3.5 text-muted-foreground/60 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div className="space-y-2 border-t border-border/20 px-3 py-2 text-xs">
          {explanation && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Explanation
              </span>
              <p className="text-xs text-muted-foreground/90 whitespace-pre-wrap">
                {explanation}
              </p>
            </div>
          )}
          {toolArgsRaw && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Parameters
              </span>
              <MessageCodeBlock
                code={toolArgsRaw}
                language="json"
                label={toolName}
                className="my-0 shadow-none border-border/30"
                bodyClassName="px-2.5 py-1.5 text-[11px]"
              />
            </div>
          )}
          <div className="space-y-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground cursor-pointer select-none transition-colors"
              onClick={() => setIsReturnOpen((prev) => !prev)}
            >
              <span>Return</span>
              <IconChevronRight
                className={cn(
                  "size-3 transition-transform duration-200",
                  isReturnOpen && "rotate-90",
                )}
              />
            </button>
            {isReturnOpen && (
              <MessageCodeBlock
                code={returnContent}
                language={returnLanguage}
                label={`${toolName} return`}
                className="my-0 shadow-none border-border/30"
                bodyClassName="px-2.5 py-1.5 text-[11px]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ThoughtBlock({
  content,
  isStreaming,
  formattedTimestamp,
  copy,
  isCopied,
  copyMessageLabel,
}: {
  content: string
  isStreaming: boolean
  trimmedModelName?: string
  formattedTimestamp: string
  copy: (text: string) => Promise<boolean>
  isCopied: boolean
  copyMessageLabel: string
  t?: (key: string, defaultValue?: string) => string
}) {
  // Starts expanded while streaming; starts collapsed once finished
  const [isExpanded, setIsExpanded] = useState(() => isStreaming)
  const prevStreamingRef = useRef(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true)
    } else if (prevStreamingRef.current && !isStreaming) {
      setIsExpanded(false)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  const toggle = () => {
    setIsExpanded((prev) => !prev)
  }

  const tokenCount = estimateTokens(content)

  return (
    <div className="w-full relative overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/5 dark:border-violet-500/20 dark:bg-violet-950/15 shadow-2xs">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-violet-600/50" />

      <div
        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs font-medium select-none transition-colors hover:bg-violet-500/10"
        onClick={toggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400">
            {isStreaming ? (
              <IconLoader2 className="size-3 animate-spin" />
            ) : (
              <IconBrain className="size-3.5" />
            )}
          </div>
          <span className="font-semibold text-violet-950 dark:text-violet-200">
            {isStreaming ? "Reasoning…" : "Reasoning"}
          </span>
          <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-violet-600 dark:text-violet-400">
            {isStreaming
              ? `~${formatTokens(tokenCount)} tok`
              : `${formatTokens(tokenCount)} tokens`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {formattedTimestamp && (
            <span className="text-[10px] text-muted-foreground/50">
              {formattedTimestamp}
            </span>
          )}
          {!isStreaming && content && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 p-0 text-violet-600/70 hover:text-violet-600 hover:bg-violet-500/15 dark:text-violet-400/70 dark:hover:text-violet-300"
              onClick={(e) => {
                e.stopPropagation()
                void copy(content)
              }}
              title={copyMessageLabel}
            >
              {isCopied ? (
                <IconCheck className="size-3 text-emerald-500" />
              ) : (
                <IconCopy className="size-3" />
              )}
            </Button>
          )}
          <IconChevronDown
            className={cn(
              "size-4 text-violet-500/70 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-violet-500/15 px-3.5 py-2.5">
          <div className="max-h-72 overflow-y-auto pr-1 text-[13px] leading-relaxed text-muted-foreground/90 font-mono">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
              components={{ pre: MarkdownCodeBlock }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function formatWorkDuration(ms: number): string {
  if (ms <= 0) return "<1s"
  if (ms < 1000) return `${ms}ms`
  const totalSec = ms / 1000
  if (totalSec < 60) {
    if (totalSec < 10) return `${totalSec.toFixed(1)}s`
    return `${Math.round(totalSec)}s`
  }
  const minutes = Math.floor(totalSec / 60)
  const remainingSec = Math.round(totalSec % 60)
  if (remainingSec === 0) return `${minutes}m`
  return `${minutes}m ${remainingSec}s`
}

function InnerReasoningBlock({
  content,
  isStreaming,
  isActive = false,
}: {
  content: string
  isStreaming: boolean
  isActive?: boolean
}) {
  const [isOpen, setIsOpen] = useState(() => isActive)
  const prevActiveRef = useRef(isActive)

  useEffect(() => {
    if (isActive) {
      setIsOpen(true)
    } else if (prevActiveRef.current && !isActive) {
      setIsOpen(false)
    }
    prevActiveRef.current = isActive
  }, [isActive])

  const tokenCount = estimateTokens(content)

  return (
    <div className="w-full rounded-lg border border-violet-500/20 bg-violet-500/5 dark:bg-violet-950/20 text-xs text-muted-foreground/90 font-mono transition-all">
      <div
        className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 select-none hover:bg-violet-500/10 rounded-lg transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-1.5 font-semibold text-violet-900 dark:text-violet-200">
          <IconBrain className="size-3.5 text-violet-500" />
          <span>Reasoning</span>
          {tokenCount > 0 && (
            <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-violet-600 dark:text-violet-400">
              {isStreaming
                ? `~${formatTokens(tokenCount)} tok`
                : `${formatTokens(tokenCount)} tokens`}
            </span>
          )}
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-violet-600/80 dark:text-violet-400/80 hover:text-violet-700 dark:hover:text-violet-300 font-sans cursor-pointer"
          aria-label={isOpen ? "Collapse reasoning" : "Expand reasoning"}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen((prev) => !prev)
          }}
        >
          <span>{isOpen ? "Collapse" : "Expand"}</span>
          <IconChevronRight
            className={cn(
              "size-3.5 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-violet-500/15 px-3 py-2.5">
          <div className="max-h-60 overflow-y-auto pr-1 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
              components={{ pre: MarkdownCodeBlock }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export function WorkedSectionGroup({
  toolCalls = [],
  thoughtContent,
  modelName: _modelName,
  isStreaming = false,
  timestamp,
  formattedTimestamp: externalFormattedTimestamp,
  durationMs: externalDurationMs,
}: {
  toolCalls?: ChatToolCall[]
  thoughtContent?: string
  modelName?: string
  isStreaming?: boolean
  timestamp?: string | number
  formattedTimestamp?: string
  durationMs?: number
}) {
  const [isExpanded, setIsExpanded] = useState(() => isStreaming)
  const [durationMs, setDurationMs] = useState<number>(externalDurationMs ?? 0)
  const startTimeRef = useRef<number>(Date.now())
  const prevStreamingRef = useRef(isStreaming)

  const formattedTimestamp =
    externalFormattedTimestamp ||
    (timestamp !== undefined && timestamp !== ""
      ? formatMessageTime(timestamp)
      : "")

  useEffect(() => {
    if (isStreaming) {
      startTimeRef.current = Date.now()
      setIsExpanded(true)
    } else if (prevStreamingRef.current && !isStreaming) {
      const elapsed = Math.max(300, Date.now() - startTimeRef.current)
      setDurationMs((prev) => (prev > 0 ? prev : elapsed))
      setIsExpanded(false)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  const toggle = () => {
    setIsExpanded((prev) => !prev)
  }

  const hasAnyError = toolCalls.some((tc) => {
    const exp = tc.extraContent?.toolFeedbackExplanation?.toLowerCase() ?? ""
    return (
      exp.includes("error") ||
      exp.includes("failed") ||
      exp.includes("fatal") ||
      exp.includes("exception")
    )
  })

  const toolCount = toolCalls.length
  const hasThought = Boolean(thoughtContent && thoughtContent.trim())
  const countBadges: string[] = []
  if (toolCount > 0)
    countBadges.push(`${toolCount} ${toolCount === 1 ? "tool" : "tools"}`)
  if (hasThought) countBadges.push("1 reasoning")

  const totalDiff = toolCalls.reduce(
    (acc, tc) => {
      const d = extractDiff(
        parseToolArgs(tc.function?.arguments),
        tc,
        tc.function?.name,
      )
      return { added: acc.added + d.added, removed: acc.removed + d.removed }
    },
    { added: 0, removed: 0 },
  )
  if (totalDiff.added > 0 || totalDiff.removed > 0) {
    countBadges.push(`+${totalDiff.added} / -${totalDiff.removed}`)
  }

  const durationText = formatWorkDuration(durationMs)
  const sectionTitle = isStreaming ? "Working…" : `Worked for ${durationText}`

  return (
    <div className="w-full relative overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-2xs backdrop-blur-xs">
      {/* Ghost-Cortex style Worked for / Working header */}
      <div
        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs font-medium select-none transition-colors hover:bg-muted/40"
        onClick={toggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              hasAnyError
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : isStreaming
                  ? "bg-primary/15 text-primary"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {isStreaming ? (
              <IconLoader2 className="size-3 animate-spin" />
            ) : hasAnyError ? (
              <IconAlertCircle className="size-3.5" />
            ) : (
              <IconSparkles className="size-3.5" />
            )}
          </div>
          <span className="font-semibold text-foreground/90 truncate">
            {sectionTitle}
          </span>
          {countBadges.length > 0 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {countBadges.join(" • ")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {formattedTimestamp && (
            <span className="text-[10px] text-muted-foreground/50">
              {formattedTimestamp}
            </span>
          )}
          <IconChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </div>

      {/* Executed tools & thoughts rendered under one unified working section */}
      {isExpanded && (
        <div className="border-t border-border/30 px-2 py-2 space-y-2">
          {hasThought && (
            <InnerReasoningBlock
              content={thoughtContent!}
              isStreaming={isStreaming}
              isActive={isStreaming && toolCalls.length === 0}
            />
          )}

          {toolCount > 0 && (
            <div className="divide-y divide-border/20">
              {toolCalls.map((tc, index) => (
                <ToolRowItem
                  key={tc.id ?? `${tc.function?.name ?? "tool"}-${index}`}
                  toolCall={tc}
                  isStreaming={isStreaming}
                  isLast={index === toolCalls.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const ToolCallsBlock = WorkedSectionGroup

interface AssistantMessageProps {
  id?: string
  content: string
  attachments?: ChatAttachment[]
  kind?: AssistantMessageKind
  modelName?: string
  toolCalls?: ChatToolCall[]
  timestamp?: string | number
  isStreaming?: boolean
  totalBranches?: number
  currentBranchIndex?: number
  isBranchLocked?: boolean
  hideHeader?: boolean
  onSwitchBranch?: (targetIndex: number) => void
  onRegenerate?: () => void
  speakingMessageId?: string | null
  onReadAloud?: (text: string) => void
}

export function AssistantMessage({
  id,
  content,
  attachments = [],
  kind = "normal",
  modelName,
  toolCalls = [],
  timestamp = "",
  isStreaming = false,
  totalBranches = 1,
  currentBranchIndex = 0,
  isBranchLocked = false,
  hideHeader = false,
  onSwitchBranch,
  onRegenerate,
  speakingMessageId,
  onReadAloud,
}: AssistantMessageProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const [isConfirmingRegen, setIsConfirmingRegen] = useState(false)
  const isSpeakingThis = Boolean(id && speakingMessageId === id)
  const isThought = kind === "thought"
  const isToolCalls = kind === "tool_calls"
  const hasText = content.trim().length > 0
  const hasToolCalls = toolCalls.length > 0
  const imageAttachments = attachments.filter(
    (attachment) => attachment.type === "image",
  )
  const fileAttachments = attachments.filter(
    (attachment) => attachment.type !== "image",
  )

  const formattedTimestamp =
    timestamp !== "" ? formatMessageTime(timestamp) : ""
  const copyMessageLabel = isCopied
    ? t("chat.copiedLabel")
    : t("chat.copyMessage")
  const trimmedModelName = modelName?.trim() ?? ""

  if (isThought) {
    return (
      <div className="group flex w-full flex-col gap-1.5">
        <ThoughtBlock
          content={content}
          isStreaming={isStreaming}
          formattedTimestamp={formattedTimestamp}
          copy={copy}
          isCopied={isCopied}
          copyMessageLabel={copyMessageLabel}
        />
      </div>
    )
  }

  if (isToolCalls && hasToolCalls) {
    return (
      <div className="group flex w-full flex-col gap-1.5">
        <WorkedSectionGroup
          toolCalls={toolCalls}
          modelName={trimmedModelName}
          isStreaming={isStreaming}
          formattedTimestamp={formattedTimestamp}
        />
      </div>
    )
  }

  return (
    <div className="group flex w-full flex-col gap-1.5">
      {!hideHeader && (
        <div className="text-muted-foreground/60 flex items-center justify-between gap-2 px-1 text-xs opacity-70">
          <div className="flex items-center gap-2">
            <span>PicoClaw</span>
            {trimmedModelName && (
              <>
                <span className="opacity-50">•</span>
                <span className="font-mono">{trimmedModelName}</span>
              </>
            )}
            {formattedTimestamp && (
              <>
                <span className="opacity-50">•</span>
                <span>{formattedTimestamp}</span>
              </>
            )}
          </div>
        </div>
      )}

      {hasToolCalls && (
        <WorkedSectionGroup
          toolCalls={toolCalls}
          modelName={trimmedModelName}
          isStreaming={isStreaming}
          formattedTimestamp={formattedTimestamp}
        />
      )}

      {hasText && (
        <div className="w-full space-y-1.5">
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground">
            <div className="prose dark:prose-invert prose-p:my-2 prose-p:whitespace-pre-wrap prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border prose-pre:bg-zinc-100 prose-pre:p-0 prose-pre:text-zinc-900 dark:prose-pre:bg-zinc-950 dark:prose-pre:text-zinc-100 max-w-none [overflow-wrap:anywhere] break-words p-4 text-[15px] leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
                components={{
                  pre: MarkdownCodeBlock,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Bottom Action Bar: Copy, Read Aloud, Regenerate, Branch Switcher */}
          {!isStreaming && (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 sm:size-7.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                  onClick={() => void copy(content)}
                  aria-label={copyMessageLabel}
                  title={copyMessageLabel}
                >
                  {isCopied ? (
                    <IconCheck className="size-3.5 sm:size-4 text-emerald-500" />
                  ) : (
                    <IconCopy className="size-3.5 sm:size-4" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-7 sm:size-7.5 rounded-lg transition-colors",
                    isSpeakingThis
                      ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-500/25 ring-1 ring-violet-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                  )}
                  onClick={() => onReadAloud?.(content)}
                  aria-label={isSpeakingThis ? "Stop speaking" : "Read aloud"}
                  title={isSpeakingThis ? "Stop speaking" : "Read aloud"}
                >
                  {isSpeakingThis ? (
                    <IconVolumeOff className="size-3.5 sm:size-4 animate-pulse text-violet-500" />
                  ) : (
                    <IconVolume className="size-3.5 sm:size-4" />
                  )}
                </Button>

                {onRegenerate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 sm:size-7.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    onClick={() => setIsConfirmingRegen(true)}
                    disabled={isStreaming || isBranchLocked}
                    aria-label="Regenerate response"
                    title={
                      isBranchLocked
                        ? "Branching locked while agent is working"
                        : "Regenerate response"
                    }
                  >
                    <IconRefresh className="size-3.5 sm:size-4" />
                  </Button>
                )}
              </div>

              {totalBranches > 1 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/40 text-[11px] font-mono select-none">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={currentBranchIndex <= 0 || isBranchLocked}
                    onClick={() => onSwitchBranch?.(currentBranchIndex - 1)}
                    title={
                      isBranchLocked
                        ? "Branching locked while agent is working"
                        : "Previous branch"
                    }
                    aria-label="Previous branch"
                  >
                    <IconChevronLeft className="size-3.5" />
                  </Button>
                  <span className="px-1 text-muted-foreground font-medium">
                    {currentBranchIndex + 1} / {totalBranches}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={
                      currentBranchIndex >= totalBranches - 1 ||
                      isBranchLocked
                    }
                    onClick={() => onSwitchBranch?.(currentBranchIndex + 1)}
                    title={
                      isBranchLocked
                        ? "Branching locked while agent is working"
                        : "Next branch"
                    }
                    aria-label="Next branch"
                  >
                    <IconChevronRight className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <AlertDialog
            open={isConfirmingRegen}
            onOpenChange={setIsConfirmingRegen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate Response?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a new branch for this response. Your previous version will be preserved, and you can switch between branches anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setIsConfirmingRegen(false)
                    onRegenerate?.()
                  }}
                >
                  Regenerate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {imageAttachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {imageAttachments.map((attachment, index) => (
            <a
              key={`${attachment.url}-${index}`}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="group/img border-border/50 bg-muted/30 hover:border-border/80 relative overflow-hidden rounded-xl border shadow-sm transition-colors"
            >
              <img
                src={attachment.url}
                alt={attachment.filename || "Attached image"}
                className="max-h-80 max-w-[280px] object-contain transition-transform duration-300 group-hover/img:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover/img:bg-black/10 dark:group-hover/img:bg-black/20" />
            </a>
          ))}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-3">
          {fileAttachments.map((attachment, index) => (
            <a
              key={`${attachment.url}-${index}`}
              href={attachment.url}
              download={attachment.filename}
              className="group/file border-border/60 bg-card flex w-fit max-w-sm min-w-[220px] items-center gap-3.5 rounded-xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-sm dark:hover:border-violet-500/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-violet-400 ring-1 ring-violet-500/10 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30">
                <IconFileText className="h-5 w-5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col pr-1">
                <span className="text-foreground/90 truncate text-[14px] leading-tight font-medium transition-colors group-hover/file:text-violet-600 dark:group-hover/file:text-violet-400">
                  {attachment.filename || "Download file"}
                </span>
                <span className="text-muted-foreground/70 mt-1 text-[12px] font-medium">
                  {attachment.filename?.split(".").pop()?.toUpperCase() ||
                    "FILE"}
                </span>
              </div>
              <div className="bg-muted/60 text-muted-foreground/50 dark:bg-muted/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover/file:bg-violet-400 group-hover/file:text-white group-hover/file:shadow-sm dark:group-hover/file:bg-violet-400">
                <IconDownload className="h-4 w-4 transition-transform duration-300 group-hover/file:-translate-y-[1px]" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
