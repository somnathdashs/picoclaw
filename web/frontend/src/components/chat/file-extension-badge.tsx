import {
  IconBrandCpp,
  IconBrandCSharp,
  IconBrandDocker,
  IconBrandGolang,
  IconBrandKotlin,
  IconBrandPython,
  IconBrandSwift,
  IconFile,
  IconFileCode,
  IconFileTypeBmp,
  IconFileTypeCss,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypeDocx,
  IconFileTypeHtml,
  IconFileTypeJpg,
  IconFileTypeJs,
  IconFileTypeJsx,
  IconFileTypePdf,
  IconFileTypePhp,
  IconFileTypePng,
  IconFileTypePpt,
  IconFileTypeRs,
  IconFileTypeSql,
  IconFileTypeSvg,
  IconFileTypeTs,
  IconFileTypeTsx,
  IconFileTypeTxt,
  IconFileTypeVue,
  IconFileTypeXls,
  IconFileTypeXml,
  IconFileTypeZip,
  IconJson,
  IconMusic,
  IconPhoto,
  IconVideo,
} from "@tabler/icons-react"
import { useMemo } from "react"

export function getFileExtension(filename: string): string {
  if (!filename) return ""
  const clean = filename.split("?")[0].split("#")[0]
  const lastSlash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"))
  const baseName = lastSlash !== -1 ? clean.slice(lastSlash + 1) : clean
  const lastDot = baseName.lastIndexOf(".")
  if (lastDot === -1) {
    return baseName.toLowerCase()
  }
  if (lastDot === 0) {
    return baseName.slice(1).toLowerCase()
  }
  return baseName.slice(lastDot + 1).toLowerCase()
}

export type FileTypeCategory =
  | "pdf"
  | "doc"
  | "excel"
  | "image"
  | "video"
  | "audio"
  | "svg"
  | "code"
  | "archive"
  | "text"
  | "other"

export interface FileTypeMeta {
  category: FileTypeCategory
  label: string
  bgClass: string
  textClass: string
  borderClass: string
}

export function getFileTypeMeta(filename: string, contentType?: string): FileTypeMeta {
  const ext = getFileExtension(filename)
  const mime = (contentType || "").toLowerCase()
  const clean = (filename || "").split("?")[0].split("#")[0]
  const lastSlash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"))
  const baseName = (lastSlash !== -1 ? clean.slice(lastSlash + 1) : clean).toLowerCase()

  // Match common special configuration and code filenames
  if (
    baseName === "dockerfile" ||
    baseName.startsWith("dockerfile.") ||
    baseName === "makefile" ||
    baseName === "gnumakefile" ||
    baseName === "cmakelists.txt" ||
    baseName === "gemfile" ||
    baseName === "procfile" ||
    baseName === "license" ||
    baseName === "licence" ||
    baseName === "readme" ||
    baseName.startsWith(".env") ||
    baseName === ".gitignore" ||
    baseName === ".gitattributes" ||
    baseName === ".gitmodules" ||
    baseName === ".editorconfig" ||
    baseName === ".prettierrc" ||
    baseName === ".eslintrc" ||
    baseName === ".dockerignore" ||
    baseName === "go.mod" ||
    baseName === "go.sum" ||
    baseName === "cargo.lock" ||
    baseName === "pnpm-lock.yaml" ||
    baseName === "yarn.lock" ||
    baseName === "package-lock.json"
  ) {
    return {
      category: "code",
      label: (ext || "CODE").toUpperCase(),
      bgClass: "bg-indigo-500/15 dark:bg-indigo-500/25",
      textClass: "text-indigo-600 dark:text-indigo-400",
      borderClass: "border-indigo-500/35",
    }
  }

  if (ext === "pdf" || mime === "application/pdf") {
    return {
      category: "pdf",
      label: "PDF",
      bgClass: "bg-rose-500/15 dark:bg-rose-500/25",
      textClass: "text-rose-600 dark:text-rose-400",
      borderClass: "border-rose-500/35",
    }
  }

  if (["doc", "docx", "odt", "rtf"].includes(ext) || mime.includes("word") || mime.includes("officedocument.word")) {
    return {
      category: "doc",
      label: (ext || "DOC").toUpperCase(),
      bgClass: "bg-blue-600/15 dark:bg-blue-500/25",
      textClass: "text-blue-600 dark:text-blue-400",
      borderClass: "border-blue-500/35",
    }
  }

  if (["ppt", "pptx", "odp"].includes(ext) || mime.includes("presentation") || mime.includes("powerpoint")) {
    return {
      category: "other",
      label: (ext || "PPT").toUpperCase(),
      bgClass: "bg-orange-600/15 dark:bg-orange-500/25",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-500/35",
    }
  }

  if (["xls", "xlsx", "ods"].includes(ext) || mime.includes("sheet") || mime.includes("excel")) {
    return {
      category: "excel",
      label: (ext || "XLS").toUpperCase(),
      bgClass: "bg-emerald-600/15 dark:bg-emerald-500/25",
      textClass: "text-emerald-600 dark:text-emerald-400",
      borderClass: "border-emerald-500/35",
    }
  }

  if (["csv", "tsv"].includes(ext) || mime === "text/csv") {
    return {
      category: "excel",
      label: ext.toUpperCase(),
      bgClass: "bg-teal-600/15 dark:bg-teal-500/25",
      textClass: "text-teal-600 dark:text-teal-400",
      borderClass: "border-teal-500/35",
    }
  }

  if (ext === "svg" || mime === "image/svg+xml") {
    return {
      category: "svg",
      label: "SVG",
      bgClass: "bg-amber-500/15 dark:bg-amber-500/25",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-500/35",
    }
  }

  // TypeScript / TSX
  if (["ts", "tsx"].includes(ext)) {
    return {
      category: "code",
      label: ext.toUpperCase(),
      bgClass: "bg-[#3178c6]/15 dark:bg-[#3178c6]/25",
      textClass: "text-[#3178c6] dark:text-[#60a5fa]",
      borderClass: "border-[#3178c6]/35",
    }
  }

  // JavaScript / JSX
  if (["js", "jsx", "mjs", "cjs"].includes(ext)) {
    return {
      category: "code",
      label: ext.toUpperCase(),
      bgClass: "bg-amber-400/15 dark:bg-amber-400/25",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-400/35",
    }
  }

  // Python
  if (["py", "pyw"].includes(ext)) {
    return {
      category: "code",
      label: "PY",
      bgClass: "bg-[#3572A5]/15 dark:bg-[#3572A5]/25",
      textClass: "text-[#3572A5] dark:text-[#60a5fa]",
      borderClass: "border-[#3572A5]/35",
    }
  }

  // Go
  if (ext === "go") {
    return {
      category: "code",
      label: "GO",
      bgClass: "bg-[#00ADD8]/15 dark:bg-[#00ADD8]/25",
      textClass: "text-[#0096ba] dark:text-[#38bdf8]",
      borderClass: "border-[#00ADD8]/35",
    }
  }

  // Rust
  if (ext === "rs") {
    return {
      category: "code",
      label: "RS",
      bgClass: "bg-orange-500/15 dark:bg-orange-500/25",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-500/35",
    }
  }

  // C++ / C / C#
  if (["cpp", "cc", "cxx", "hpp"].includes(ext)) {
    return {
      category: "code",
      label: "C++",
      bgClass: "bg-pink-500/15 dark:bg-pink-500/25",
      textClass: "text-pink-600 dark:text-pink-400",
      borderClass: "border-pink-500/35",
    }
  }
  if (["c", "h"].includes(ext)) {
    return {
      category: "code",
      label: "C",
      bgClass: "bg-zinc-500/15 dark:bg-zinc-500/25",
      textClass: "text-zinc-600 dark:text-zinc-300",
      borderClass: "border-zinc-500/35",
    }
  }
  if (ext === "cs") {
    return {
      category: "code",
      label: "C#",
      bgClass: "bg-purple-600/15 dark:bg-purple-600/25",
      textClass: "text-purple-600 dark:text-purple-400",
      borderClass: "border-purple-600/35",
    }
  }

  // HTML / CSS / SCSS / SASS
  if (["html", "htm"].includes(ext)) {
    return {
      category: "code",
      label: "HTML",
      bgClass: "bg-orange-600/15 dark:bg-orange-600/25",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-600/35",
    }
  }
  if (["css", "scss", "sass", "less"].includes(ext)) {
    return {
      category: "code",
      label: ext.toUpperCase(),
      bgClass: "bg-purple-600/15 dark:bg-purple-600/25",
      textClass: "text-purple-600 dark:text-purple-400",
      borderClass: "border-purple-600/35",
    }
  }

  // Kotlin / Swift / Java / PHP / SQL / Vue
  if (["kt", "kts"].includes(ext)) {
    return {
      category: "code",
      label: "KT",
      bgClass: "bg-orange-500/15 dark:bg-orange-500/25",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-500/35",
    }
  }
  if (ext === "swift") {
    return {
      category: "code",
      label: "SWIFT",
      bgClass: "bg-orange-600/15 dark:bg-orange-600/25",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-600/35",
    }
  }
  if (ext === "java") {
    return {
      category: "code",
      label: "JAVA",
      bgClass: "bg-amber-700/15 dark:bg-amber-600/25",
      textClass: "text-amber-700 dark:text-amber-400",
      borderClass: "border-amber-700/35",
    }
  }
  if (ext === "php") {
    return {
      category: "code",
      label: "PHP",
      bgClass: "bg-indigo-600/15 dark:bg-indigo-600/25",
      textClass: "text-indigo-600 dark:text-indigo-400",
      borderClass: "border-indigo-600/35",
    }
  }
  if (ext === "sql") {
    return {
      category: "code",
      label: "SQL",
      bgClass: "bg-amber-600/15 dark:bg-amber-500/25",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-600/35",
    }
  }
  if (ext === "vue") {
    return {
      category: "code",
      label: "VUE",
      bgClass: "bg-emerald-500/15 dark:bg-emerald-500/25",
      textClass: "text-emerald-600 dark:text-emerald-400",
      borderClass: "border-emerald-500/35",
    }
  }
  if (ext === "json") {
    return {
      category: "code",
      label: "JSON",
      bgClass: "bg-amber-500/15 dark:bg-amber-500/25",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-500/35",
    }
  }
  if (ext === "xml") {
    return {
      category: "code",
      label: "XML",
      bgClass: "bg-blue-600/15 dark:bg-blue-500/25",
      textClass: "text-blue-600 dark:text-blue-400",
      borderClass: "border-blue-500/35",
    }
  }

  // Other code extensions and config formats
  if (
    [
      "rb",
      "sh",
      "bash",
      "zsh",
      "fish",
      "ksh",
      "ps1",
      "psm1",
      "bat",
      "cmd",
      "yaml",
      "yml",
      "toml",
      "ini",
      "conf",
      "config",
      "cfg",
      "properties",
      "env",
      "dockerfile",
      "makefile",
      "mk",
      "cmake",
      "gradle",
      "mod",
      "sum",
      "lock",
      "lua",
      "r",
      "rmd",
      "dart",
      "zig",
      "nim",
      "scala",
      "clj",
      "cljs",
      "edn",
      "ex",
      "exs",
      "erl",
      "hs",
      "lhs",
      "elm",
      "fs",
      "fsx",
      "sol",
      "proto",
      "graphql",
      "gql",
      "svelte",
      "astro",
      "prisma",
      "jsonc",
      "json5",
      "diff",
      "patch",
      "tex",
      "bib",
      "v",
      "sv",
    ].includes(ext) ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("xml") ||
    mime.includes("yaml") ||
    mime.includes("x-sh") ||
    mime.includes("x-python")
  ) {
    return {
      category: "code",
      label: (ext || "CODE").toUpperCase(),
      bgClass: "bg-indigo-500/15 dark:bg-indigo-500/25",
      textClass: "text-indigo-600 dark:text-indigo-400",
      borderClass: "border-indigo-500/35",
    }
  }

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff"].includes(ext) || mime.startsWith("image/")) {
    return {
      category: "image",
      label: (ext || "IMG").toUpperCase(),
      bgClass: "bg-sky-500/15 dark:bg-sky-500/25",
      textClass: "text-sky-600 dark:text-sky-400",
      borderClass: "border-sky-500/35",
    }
  }

  // Video
  if (["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv"].includes(ext) || mime.startsWith("video/")) {
    return {
      category: "video",
      label: (ext || "VID").toUpperCase(),
      bgClass: "bg-purple-500/15 dark:bg-purple-500/25",
      textClass: "text-purple-600 dark:text-purple-400",
      borderClass: "border-purple-500/35",
    }
  }

  // Audio
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext) || mime.startsWith("audio/")) {
    return {
      category: "audio",
      label: (ext || "AUD").toUpperCase(),
      bgClass: "bg-fuchsia-500/15 dark:bg-fuchsia-500/25",
      textClass: "text-fuchsia-600 dark:text-fuchsia-400",
      borderClass: "border-fuchsia-500/35",
    }
  }

  // Archives
  if (["zip", "tar", "gz", "tgz", "rar", "7z", "bz2", "xz"].includes(ext)) {
    return {
      category: "archive",
      label: (ext || "ZIP").toUpperCase(),
      bgClass: "bg-yellow-500/15 dark:bg-yellow-500/25",
      textClass: "text-yellow-600 dark:text-yellow-400",
      borderClass: "border-yellow-500/35",
    }
  }

  // Plain Text / Docs
  if (["txt", "md", "markdown", "log"].includes(ext) || mime.startsWith("text/")) {
    return {
      category: "text",
      label: (ext || "TXT").toUpperCase(),
      bgClass: "bg-slate-500/15 dark:bg-slate-500/25",
      textClass: "text-slate-600 dark:text-slate-400",
      borderClass: "border-slate-500/35",
    }
  }

  return {
    category: "other",
    label: (ext || "FILE").toUpperCase(),
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-border/60",
  }
}

interface FileIconProps {
  filename: string
  contentType?: string
  className?: string
}

export function FileIcon({ filename, contentType, className = "size-4" }: FileIconProps) {
  const ext = getFileExtension(filename)
  const meta = useMemo(() => getFileTypeMeta(filename, contentType), [filename, contentType])

  switch (ext) {
    case "pdf":
      return <IconFileTypePdf className={className} />
    case "doc":
      return <IconFileTypeDoc className={className} />
    case "docx":
      return <IconFileTypeDocx className={className} />
    case "xls":
    case "xlsx":
    case "ods":
      return <IconFileTypeXls className={className} />
    case "csv":
    case "tsv":
      return <IconFileTypeCsv className={className} />
    case "ppt":
    case "pptx":
      return <IconFileTypePpt className={className} />
    case "svg":
      return <IconFileTypeSvg className={className} />
    case "png":
      return <IconFileTypePng className={className} />
    case "jpg":
    case "jpeg":
      return <IconFileTypeJpg className={className} />
    case "bmp":
      return <IconFileTypeBmp className={className} />
    case "zip":
    case "tar":
    case "gz":
    case "tgz":
    case "rar":
    case "7z":
      return <IconFileTypeZip className={className} />
    case "txt":
    case "log":
      return <IconFileTypeTxt className={className} />
    case "html":
    case "htm":
      return <IconFileTypeHtml className={className} />
    case "css":
    case "scss":
    case "sass":
    case "less":
      return <IconFileTypeCss className={className} />
    case "js":
    case "mjs":
    case "cjs":
      return <IconFileTypeJs className={className} />
    case "jsx":
      return <IconFileTypeJsx className={className} />
    case "ts":
      return <IconFileTypeTs className={className} />
    case "tsx":
      return <IconFileTypeTsx className={className} />
    case "py":
    case "pyw":
      return <IconBrandPython className={className} />
    case "go":
      return <IconBrandGolang className={className} />
    case "rs":
      return <IconFileTypeRs className={className} />
    case "cpp":
    case "cc":
    case "cxx":
      return <IconBrandCpp className={className} />
    case "cs":
      return <IconBrandCSharp className={className} />
    case "kt":
    case "kts":
      return <IconBrandKotlin className={className} />
    case "swift":
      return <IconBrandSwift className={className} />
    case "php":
      return <IconFileTypePhp className={className} />
    case "sql":
      return <IconFileTypeSql className={className} />
    case "xml":
      return <IconFileTypeXml className={className} />
    case "vue":
      return <IconFileTypeVue className={className} />
    case "json":
      return <IconJson className={className} />
    case "dockerfile":
      return <IconBrandDocker className={className} />
    default:
      if (meta.category === "image") return <IconPhoto className={className} />
      if (meta.category === "video") return <IconVideo className={className} />
      if (meta.category === "audio") return <IconMusic className={className} />
      if (meta.category === "code") return <IconFileCode className={className} />
      return <IconFile className={className} />
  }
}

interface FileExtensionBadgeProps {
  filename: string
  contentType?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function FileExtensionBadge({
  filename,
  contentType,
  size = "md",
  className = "",
}: FileExtensionBadgeProps) {
  const meta = useMemo(() => getFileTypeMeta(filename, contentType), [filename, contentType])

  if (size === "sm") {
    return (
      <div
        className={`flex size-6 shrink-0 items-center justify-center ${meta.textClass} ${className}`}
      >
        <FileIcon filename={filename} contentType={contentType} className="size-4" />
      </div>
    )
  }

  if (size === "lg") {
    return (
      <div
        className={`flex shrink-0 flex-col items-center justify-center font-mono ${meta.textClass} ${className}`}
      >
        <FileIcon filename={filename} contentType={contentType} className="size-10" />
        <span className="font-bold text-[10px] tracking-wider leading-none mt-1">
          {meta.label.slice(0, 4)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center ${meta.textClass} ${className}`}
    >
      <FileIcon filename={filename} contentType={contentType} className="size-6" />
    </div>
  )
}
