import {
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconEye,
  IconFile,
  IconRefresh,
  IconSearch,
  IconTable,
  IconTextWrap,
  IconX,
} from "@tabler/icons-react"
import hljs from "highlight.js"
import mammoth from "mammoth"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import * as XLSX from "xlsx"

import { buildWorkspaceFileUrl } from "@/api/workspace"
import {
  FileExtensionBadge,
  getFileExtension,
  getFileTypeMeta,
} from "@/components/chat/file-extension-badge"
import {
  splitCodeIntoLines,
  splitHighlightedHtmlIntoLines,
} from "@/components/chat/message-code-block.utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { usePanelResize } from "@/hooks/use-panel-resize"

export interface PreviewableFile {
  filename: string
  url?: string
  size?: number
  contentType?: string
  path?: string
}

interface FilePreviewPanelProps {
  file: PreviewableFile
  onClose: () => void
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
  return `${size} ${units[i] || "B"}`
}

function getHighlightLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    pyw: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    json: "json",
    jsonc: "json",
    json5: "json",
    html: "xml",
    htm: "xml",
    xml: "xml",
    svg: "xml",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    ini: "ini",
    env: "ini",
    conf: "ini",
    config: "ini",
    cfg: "ini",
    properties: "ini",
    md: "markdown",
    markdown: "markdown",
    vue: "xml",
    svelte: "xml",
    astro: "xml",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    dart: "dart",
    lua: "lua",
    r: "r",
    dockerfile: "dockerfile",
    makefile: "makefile",
    cmake: "cmake",
    ps1: "powershell",
    bat: "dos",
    cmd: "dos",
    proto: "protobuf",
    graphql: "graphql",
    gql: "graphql",
    diff: "diff",
    patch: "diff",
    sol: "solidity",
    mod: "go",
    sum: "bash",
    lock: "yaml",
    gitignore: "bash",
    gitattributes: "bash",
  }
  return map[ext.toLowerCase()] || ""
}

interface PanelCodeViewerProps {
  code: string
  ext: string
  label?: string
}

function PanelCodeViewer({ code, ext, label }: PanelCodeViewerProps) {
  const [wrapLines, setWrapLines] = useState(false)
  const { copy, isCopied } = useCopyToClipboard()

  const highlightedHtml = useMemo(() => {
    if (!code) return ""
    const lang = getHighlightLanguage(ext)
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch {
        // Fallback to auto
      }
    }
    try {
      return hljs.highlightAuto(code).value
    } catch {
      return null
    }
  }, [code, ext])

  const lines = useMemo(() => {
    if (highlightedHtml) {
      return splitHighlightedHtmlIntoLines(highlightedHtml)
    }
    return splitCodeIntoLines(code)
  }, [highlightedHtml, code])

  const lineNumberWidth = `${String(lines.length).length + 1}ch`

  return (
    <div
      data-picoclaw-code-block=""
      className="flex-1 min-h-0 flex flex-col bg-card/60 select-text"
    >
      <div className="p-2 border-b border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-foreground">
            {label || `${(ext || "code").toUpperCase()} SOURCE`}
          </span>
          <span className="text-[10px] text-muted-foreground/80 font-mono">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setWrapLines((prev) => !prev)}
            className={`h-6 text-[11px] gap-1 px-2 ${
              wrapLines ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title={wrapLines ? "Disable wrap" : "Wrap long lines"}
          >
            <IconTextWrap className="size-3" />
            <span className="hidden sm:inline">{wrapLines ? "Unwrap" : "Wrap"}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(code)}
            className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
            title="Copy code"
          >
            {isCopied ? (
              <>
                <IconCheck className="size-3 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <IconCopy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto font-mono text-xs leading-relaxed">
        <pre className="m-0 p-3 bg-transparent font-mono text-xs leading-5">
          <code className="block bg-transparent p-0 text-inherit hljs">
            {lines.map((line, idx) => (
              <span
                key={idx}
                className="grid grid-cols-[var(--code-line-number-width)_minmax(0,1fr)] items-start gap-x-3 hover:bg-muted/30 py-0.5 px-1 rounded-xs transition-colors"
                style={{ "--code-line-number-width": lineNumberWidth } as React.CSSProperties}
              >
                <span className="sticky left-0 z-1 text-right text-muted-foreground/60 select-none bg-card/90 pr-1">
                  {idx + 1}
                </span>
                <span
                  className={`min-w-0 ${
                    wrapLines ? "break-words whitespace-pre-wrap" : "whitespace-pre"
                  }`}
                  dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }}
                />
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}

export function FilePreviewPanel({ file, onClose }: FilePreviewPanelProps) {
  const { t } = useTranslation()

  const { width, isResizing, isMobile, maxScreenPercent, startResizing } = usePanelResize({
    storageKey: "picoclaw_preview_panel_width",
    defaultWidth: 460,
    maxScreenPercent: 55,
  })

  const [textContent, setTextContent] = useState<string | null>(null)
  const [showAsText, setShowAsText] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [workbookData, setWorkbookData] = useState<{
    sheetNames: string[]
    sheets: Record<string, string[][]>
  } | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>("")
  const [tableSearch, setTableSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"preview" | "raw">("preview")

  const ext = useMemo(() => getFileExtension(file.filename), [file.filename])
  const typeMeta = useMemo(
    () => getFileTypeMeta(file.filename, file.contentType),
    [file.filename, file.contentType],
  )

  const fileUrl = useMemo(() => {
    if (file.url) return file.url
    if (file.path) return buildWorkspaceFileUrl(file.path)
    return ""
  }, [file.url, file.path])

  // Convert base64 data URLs for PDFs to object URLs for reliable browser embedding
  useEffect(() => {
    if (typeMeta.category !== "pdf" || !fileUrl) {
      setPdfBlobUrl(null)
      return
    }

    if (fileUrl.startsWith("data:")) {
      try {
        const commaIdx = fileUrl.indexOf(",")
        const base64Data = fileUrl.slice(commaIdx + 1)
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "application/pdf" })
        const blobUrl = URL.createObjectURL(blob)
        setPdfBlobUrl(blobUrl)
        return () => {
          URL.revokeObjectURL(blobUrl)
        }
      } catch {
        // Fallback to raw fileUrl
      }
    }
  }, [fileUrl, typeMeta.category])

  const resolvedPdfUrl = pdfBlobUrl || fileUrl

  // Load file content according to category
  useEffect(() => {
    if (!fileUrl) return
    let isMounted = true

    if (typeMeta.category === "doc") {
      setIsLoading(true)
      setLoadError(null)
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          return res.arrayBuffer()
        })
        .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
        .then((result) => {
          if (isMounted) {
            setDocHtml(result.value || "<p class='text-muted-foreground'>No readable text in document.</p>")
            setIsLoading(false)
          }
        })
        .catch((err) => {
          if (isMounted) {
            setLoadError(err instanceof Error ? err.message : String(err))
            setIsLoading(false)
          }
        })
      return () => {
        isMounted = false
      }
    }

    if (typeMeta.category === "excel") {
      setIsLoading(true)
      setLoadError(null)
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          return res.arrayBuffer()
        })
        .then((buffer) => {
          const wb = XLSX.read(buffer, { type: "array" })
          const sheets: Record<string, string[][]> = {}
          for (const name of wb.SheetNames) {
            const ws = wb.Sheets[name]
            sheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][]
          }
          if (isMounted) {
            setWorkbookData({ sheetNames: wb.SheetNames, sheets })
            if (wb.SheetNames.length > 0) setActiveSheet(wb.SheetNames[0])
            setIsLoading(false)
          }
        })
        .catch((err) => {
          if (isMounted) {
            setLoadError(err instanceof Error ? err.message : String(err))
            setIsLoading(false)
          }
        })
      return () => {
        isMounted = false
      }
    }

    if (
      typeMeta.category === "text" ||
      typeMeta.category === "code" ||
      typeMeta.category === "svg" ||
      ext === "md" ||
      ext === "markdown" ||
      showAsText
    ) {
      setIsLoading(true)
      setLoadError(null)

      if (fileUrl.startsWith("data:")) {
        try {
          const commaIdx = fileUrl.indexOf(",")
          const base64Data = fileUrl.slice(commaIdx + 1)
          const decoded = atob(base64Data)
          setTextContent(decoded)
          setIsLoading(false)
          return
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : "Failed to decode data URL")
          setIsLoading(false)
          return
        }
      }

      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
          return res.text()
        })
        .then((text) => {
          if (isMounted) {
            setTextContent(text)
            setIsLoading(false)
          }
        })
        .catch((err) => {
          if (isMounted) {
            setLoadError(err instanceof Error ? err.message : String(err))
            setIsLoading(false)
          }
        })
      return () => {
        isMounted = false
      }
    }
  }, [fileUrl, typeMeta.category, ext, showAsText])

  // Filtered rows for Excel view
  const currentSheetRows = useMemo(() => {
    if (!workbookData || !activeSheet) return []
    const rawRows = workbookData.sheets[activeSheet] || []
    if (!tableSearch.trim()) return rawRows
    const q = tableSearch.toLowerCase()
    return rawRows.filter((row, idx) => {
      if (idx === 0) return true
      return row.some((cell) => String(cell).toLowerCase().includes(q))
    })
  }, [workbookData, activeSheet, tableSearch])

  return (
    <aside
      style={
        !isMobile && width
          ? {
              width: `${width}px`,
              maxWidth: `${maxScreenPercent}vw`,
            }
          : undefined
      }
      className={`w-full shrink-0 border-l border-border bg-card/85 flex flex-col h-full z-30 absolute inset-0 md:static ${
        isResizing ? "select-none transition-none" : "transition-all duration-200 backdrop-blur-md"
      } shadow-2xl md:shadow-none animate-in fade-in slide-in-from-right-4 relative max-w-full md:max-w-[55vw]`}>
      {/* Fullscreen overlay to capture mouse events over iframes/media during resize */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-ew-resize select-none pointer-events-auto" />
      )}

      {/* Resizer handle on desktop */}
      <div
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        className="hidden md:block absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize z-40 group"
        title="Drag to resize panel"
      >
        <div className="w-1 h-full mx-auto transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
      </div>

      {/* Top Header */}
      <div className="p-3 sm:p-3.5 border-b border-border/70 flex items-center justify-between gap-2 bg-muted/25 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileExtensionBadge filename={file.filename} contentType={file.contentType} size="sm" />
          <div className="min-w-0">
            <h2
              className="text-xs sm:text-sm font-semibold truncate text-foreground leading-tight"
              title={file.filename}
            >
              {file.filename}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span className="uppercase font-mono">{ext || typeMeta.label}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {fileUrl && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              title={t("chat.downloadFile", "Download file")}
              aria-label={t("chat.downloadFile", "Download file")}
            >
              <a href={fileUrl} download={file.filename}>
                <IconDownload className="size-4" />
              </a>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
            title={t("common.close", "Close")}
            aria-label={t("common.close", "Close")}
          >
            <IconX className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Preview View Section: full area below top header without outer padding */}
      <div className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden relative bg-background">
        {/* PDF PREVIEW */}
        {typeMeta.category === "pdf" && (
          <div className="w-full h-full flex flex-col bg-muted/10 relative">
            <object
              data={resolvedPdfUrl}
              type="application/pdf"
              className="w-full h-full border-0"
              title={file.filename}
            >
              <iframe
                src={resolvedPdfUrl}
                className="w-full h-full border-0 bg-background"
                title={file.filename}
              >
                <div className="p-6 text-center space-y-3 m-auto max-w-xs">
                  <p className="text-xs text-muted-foreground">
                    Unable to display PDF directly in browser.
                  </p>
                  <Button asChild size="sm" variant="outline" className="text-xs h-7">
                    <a href={fileUrl} download={file.filename}>
                      <IconDownload className="size-3.5 mr-1.5" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              </iframe>
            </object>
          </div>
        )}

        {/* SVG PREVIEW (Raw + Preview) */}
        {typeMeta.category === "svg" && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "preview" | "raw")}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="p-2 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="preview" className="text-[11px] px-2.5 h-6 gap-1">
                  <IconEye className="size-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="raw" className="text-[11px] px-2.5 h-6 gap-1">
                  <IconCode className="size-3" />
                  SVG Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="preview"
              className="flex-1 min-h-0 mt-0 flex items-center justify-center p-6 overflow-auto bg-muted/10"
            >
              <img
                src={fileUrl}
                alt={file.filename}
                className="max-h-full max-w-full object-contain select-none shadow-sm rounded-lg"
              />
            </TabsContent>

            <TabsContent
              value="raw"
              className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col"
            >
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  <IconRefresh className="size-4 animate-spin mr-1.5" />
                  Loading SVG code...
                </div>
              ) : loadError ? (
                <div className="text-destructive text-xs p-2">{loadError}</div>
              ) : (
                <PanelCodeViewer code={textContent || ""} ext="xml" label="SVG SOURCE" />
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* DOCS PREVIEW (DOCX / DOC / ODT) */}
        {typeMeta.category === "doc" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                <IconRefresh className="size-4 animate-spin mr-1.5" />
                Reading document...
              </div>
            ) : loadError ? (
              <div className="p-6 text-center space-y-3 m-auto max-w-xs">
                <IconFile className="size-10 text-muted-foreground mx-auto opacity-50" />
                <div className="text-xs text-destructive font-medium">{loadError}</div>
                <Button asChild size="sm" variant="outline" className="text-xs h-7">
                  <a href={fileUrl} download={file.filename}>Download Document</a>
                </Button>
              </div>
            ) : (
              <div
                className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm bg-card/60"
                dangerouslySetInnerHTML={{ __html: docHtml || "" }}
              />
            )}
          </div>
        )}

        {/* EXCEL PREVIEW (XLSX / XLS / CSV / TSV) */}
        {typeMeta.category === "excel" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[65%]">
                {workbookData &&
                  workbookData.sheetNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveSheet(name)}
                      className={`px-2.5 py-1 text-xs rounded-md transition font-medium whitespace-nowrap ${
                        activeSheet === name
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <IconTable className="size-3 inline mr-1" />
                      {name}
                    </button>
                  ))}
              </div>

              <div className="relative w-36 sm:w-44">
                <IconSearch className="size-3.5 absolute left-2 top-2 text-muted-foreground" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter rows..."
                  className="h-7 pl-7 pr-2 text-xs"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                <IconRefresh className="size-4 animate-spin mr-1.5" />
                Parsing spreadsheet...
              </div>
            ) : loadError ? (
              <div className="p-6 text-center space-y-3 m-auto max-w-xs">
                <IconTable className="size-10 text-muted-foreground mx-auto opacity-50" />
                <div className="text-xs text-destructive font-medium">{loadError}</div>
              </div>
            ) : currentSheetRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No data available in sheet.
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead className="bg-muted/70 sticky top-0 z-10 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center border-r border-border/50 text-[10px] select-none">
                        #
                      </th>
                      {currentSheetRows[0]?.map((col, idx) => (
                        <th key={idx} className="px-3 py-2 border-r border-border/50 truncate max-w-[200px]">
                          {String(col || `Col ${idx + 1}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {currentSheetRows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground/70 bg-muted/20 border-r border-border/40 font-mono select-none">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 border-r border-border/40 truncate max-w-[260px]">
                            {String(cell ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {typeMeta.category === "image" && (
          <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6 overflow-auto bg-muted/10">
            <img
              src={fileUrl}
              alt={file.filename}
              className="max-h-full max-w-full object-contain rounded-lg shadow-sm select-none"
            />
          </div>
        )}

        {/* VIDEO PREVIEW */}
        {typeMeta.category === "video" && (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-black/95 p-0">
            <video
              controls
              playsInline
              className="max-h-full max-w-full"
              src={fileUrl}
            >
              Your browser does not support video playback.
            </video>
          </div>
        )}

        {/* AUDIO PREVIEW */}
        {typeMeta.category === "audio" && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center bg-muted/15">
            <FileExtensionBadge filename={file.filename} contentType={file.contentType} size="lg" className="mb-4" />
            <div className="text-sm font-semibold text-foreground mb-1 max-w-[280px] truncate">
              {file.filename}
            </div>
            <div className="text-xs text-muted-foreground mb-6 font-medium">
              {formatFileSize(file.size)}
            </div>
            <audio controls className="w-full max-w-sm shadow-md rounded-full" src={fileUrl}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {/* MARKDOWN PREVIEW */}
        {(ext === "md" || ext === "markdown") && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "preview" | "raw")}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="p-2 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="preview" className="text-[11px] px-2.5 h-6 gap-1">
                  <IconEye className="size-3" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="raw" className="text-[11px] px-2.5 h-6 gap-1">
                  <IconCode className="size-3" />
                  Raw
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="preview"
              className="flex-1 min-h-0 mt-0 overflow-y-auto p-4 sm:p-6 text-xs prose prose-sm dark:prose-invert max-w-none"
            >
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  <IconRefresh className="size-4 animate-spin mr-1.5" />
                  Loading markdown...
                </div>
              ) : loadError ? (
                <div className="text-destructive text-xs p-2">{loadError}</div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent || ""}</ReactMarkdown>
              )}
            </TabsContent>

            <TabsContent
              value="raw"
              className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col"
            >
              <PanelCodeViewer code={textContent || ""} ext="md" label="MARKDOWN SOURCE" />
            </TabsContent>
          </Tabs>
        )}

        {/* CODE & TEXT PREVIEW */}
        {(typeMeta.category === "code" || typeMeta.category === "text") &&
          ext !== "md" &&
          ext !== "markdown" && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground p-8">
                  <IconRefresh className="size-4 animate-spin mr-1.5" />
                  Loading source...
                </div>
              ) : loadError ? (
                <div className="text-destructive text-xs p-4">{loadError}</div>
              ) : (
                <PanelCodeViewer
                  code={textContent || ""}
                  ext={ext}
                  label={`${(ext || "code").toUpperCase()} SOURCE`}
                />
              )}
            </div>
          )}

        {/* UNSUPPORTED / OTHER FALLBACK */}
        {(typeMeta.category === "other" || typeMeta.category === "archive") && !showAsText ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <FileExtensionBadge filename={file.filename} contentType={file.contentType} size="lg" />

            <div className="space-y-1 max-w-[280px]">
              <div
                className="text-sm sm:text-base font-semibold text-foreground break-all"
                title={file.filename}
              >
                {file.filename}
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                ({formatFileSize(file.size)})
              </div>
            </div>

            {fileUrl && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAsText(true)}
                  className="text-xs h-8 gap-1.5"
                >
                  <IconCode className="size-3.5" />
                  <span>View as Text / Code</span>
                </Button>
                <a
                  href={fileUrl}
                  download={file.filename}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition"
                >
                  <IconDownload className="size-3.5" />
                  <span>{t("chat.downloadFile", "Download file")}</span>
                </a>
              </div>
            )}
          </div>
        ) : null}

        {/* FORCE TEXT / CODE PREVIEW FOR FALLBACK */}
        {showAsText && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground p-8">
                <IconRefresh className="size-4 animate-spin mr-1.5" />
                Loading source...
              </div>
            ) : loadError ? (
              <div className="p-6 text-center space-y-3 m-auto max-w-xs">
                <div className="text-destructive text-xs font-medium">{loadError}</div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAsText(false)}
                  className="text-xs h-7"
                >
                  Back to download
                </Button>
              </div>
            ) : (
              <PanelCodeViewer
                code={textContent || ""}
                ext={ext || "txt"}
                label={`${(ext || "file").toUpperCase()} SOURCE`}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
