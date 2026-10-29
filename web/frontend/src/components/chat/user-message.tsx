import { useEffect, useRef, useState } from "react"
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconPencil,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { formatMessageTime } from "@/hooks/use-pico-chat"
import { cn } from "@/lib/utils"
import type { ChatAttachment } from "@/store/chat"

interface UserMessageProps {
  id?: string
  content: string
  attachments?: ChatAttachment[]
  timestamp?: string | number
  totalBranches?: number
  currentBranchIndex?: number
  isBranchLocked?: boolean
  onSwitchBranch?: (targetIndex: number) => void
  onEdit?: (newText: string) => void
}

export function UserMessage({
  content,
  attachments = [],
  timestamp = "",
  totalBranches = 1,
  currentBranchIndex = 0,
  isBranchLocked = false,
  onSwitchBranch,
  onEdit,
}: UserMessageProps) {
  const { t } = useTranslation()
  const { copy, isCopied } = useCopyToClipboard()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditText(content)
  }, [content])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  const hasText = content.trim().length > 0
  const isCommand = content.trim().startsWith("/")
  const imageAttachments = attachments.filter(
    (attachment) => attachment.type === "image",
  )
  const copyMessageLabel = isCopied
    ? t("chat.copiedLabel")
    : t("chat.copyMessage")
  const formattedTimestamp =
    timestamp !== "" ? formatMessageTime(timestamp) : ""

  const handleSendEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    setIsEditing(false)
    onEdit?.(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendEdit()
    } else if (e.key === "Escape") {
      setIsEditing(false)
      setEditText(content)
    }
  }

  return (
    <div className="group flex w-full flex-col items-end gap-1.5">
      {imageAttachments.length > 0 && (
        <div className="flex max-w-[85%] sm:max-w-[70%] flex-wrap justify-end gap-2">
          {imageAttachments.map((attachment, index) => (
            <img
              key={`${attachment.url}-${index}`}
              src={attachment.url}
              alt={attachment.filename || t("chat.uploadedImage")}
              className="max-h-72 max-w-full object-cover rounded-xl border border-border/50"
            />
          ))}
        </div>
      )}

      {isEditing ? (
        <div className="flex w-full max-w-[95%] sm:max-w-[75%] flex-col gap-2 rounded-2xl border border-violet-500/30 bg-card p-3 shadow-md dark:border-violet-500/40 dark:bg-zinc-900">
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full resize-none rounded-lg border border-border/60 bg-background/50 p-2.5 text-[14px] leading-relaxed text-foreground placeholder-muted-foreground outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            placeholder="Edit your message..."
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <span className="hidden text-[11px] sm:inline">
              Enter to send, Shift+Enter for new line
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsEditing(false)
                  setEditText(content)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                disabled={!editText.trim()}
                onClick={handleSendEdit}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : (
        hasText && (
          <div className="relative max-w-[85%] sm:max-w-[70%]">
            <div
              className={cn(
                "wrap-break-word whitespace-pre-wrap",
                isCommand
                  ? "rounded-xl border border-zinc-200 bg-transparent px-4 py-3 font-mono text-[14px] text-zinc-800 dark:border-zinc-800/60 dark:bg-[#121212] dark:text-zinc-200 dark:shadow-sm"
                  : "rounded-2xl rounded-tr-sm bg-violet-500 px-5 py-3 text-[15px] leading-relaxed text-white shadow-sm",
              )}
            >
              {isCommand ? (
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 select-none dark:text-emerald-400">
                    ❯
                  </span>
                  <span className="mt-[1px]">{content}</span>
                </div>
              ) : (
                content
              )}
            </div>
          </div>
        )
      )}

      {!isEditing && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 sm:gap-1.5">
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
                    currentBranchIndex >= totalBranches - 1 || isBranchLocked
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

            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 sm:size-7.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                disabled={isBranchLocked}
                onClick={() => {
                  setEditText(content)
                  setIsEditing(true)
                }}
                aria-label="Edit message"
                title={
                  isBranchLocked
                    ? "Branching locked while agent is working"
                    : "Edit message"
                }
              >
                <IconPencil className="size-3.5 sm:size-4" />
              </Button>
            )}
          </div>

          {formattedTimestamp && (
            <span className="px-1 text-[11px] text-muted-foreground/70">
              {formattedTimestamp}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
