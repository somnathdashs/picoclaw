package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/sipeed/picoclaw/pkg/channels"
	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/media"
	"github.com/sipeed/picoclaw/pkg/utils"
)

type workspaceUploadItem struct {
	Filename string `json:"filename"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	Ref      string `json:"ref,omitempty"`
	URL      string `json:"url,omitempty"`
}

type workspaceUploadResponse struct {
	Success bool                  `json:"success"`
	Files   []workspaceUploadItem `json:"files"`
	Message string                `json:"message,omitempty"`
}

func (h *Handler) registerWorkspaceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/workspace/upload", h.handleWorkspaceUpload)
	mux.HandleFunc("GET /api/workspace/file", h.handleWorkspaceFileServe)
}

func (h *Handler) handleWorkspaceUpload(w http.ResponseWriter, r *http.Request) {
	mediaDir := media.TempDir()
	_ = os.MkdirAll(mediaDir, 0o700)

	// Limit upload size to 100MB
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	if r.MultipartForm == nil || len(r.MultipartForm.File) == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}

	uploadedFiles := make([]workspaceUploadItem, 0)
	store := h.GetMediaStore()

	for _, headers := range r.MultipartForm.File {
		for _, fileHeader := range headers {
			safeName := utils.SanitizeFilename(fileHeader.Filename)
			if safeName == "" || safeName == "." {
				safeName = "file.bin"
			}

			src, err := fileHeader.Open()
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to read file %s: %v", safeName, err), http.StatusBadRequest)
				return
			}

			targetPath := filepath.Join(mediaDir, safeName)
			if _, err := os.Stat(targetPath); err == nil {
				targetPath = filepath.Join(mediaDir, uuid.New().String()[:8]+"_"+safeName)
			}

			dst, err := os.Create(targetPath)
			if err != nil {
				src.Close()
				http.Error(w, fmt.Sprintf("Failed to save file %s: %v", safeName, err), http.StatusInternalServerError)
				return
			}

			copied, err := io.Copy(dst, src)
			src.Close()
			if closeErr := dst.Close(); closeErr != nil && err == nil {
				err = closeErr
			}
			if err != nil {
				_ = os.Remove(targetPath)
				http.Error(w, fmt.Sprintf("Failed to write file %s: %v", safeName, err), http.StatusInternalServerError)
				return
			}

			contentType := fileHeader.Header.Get("Content-Type")
			if contentType == "" {
				contentType = "application/octet-stream"
			}

			ref := targetPath
			if store != nil {
				scope := channels.BuildMediaScope("pico", "upload", uuid.New().String())
				if r, err := store.Store(targetPath, media.MediaMeta{
					Filename:      safeName,
					ContentType:   contentType,
					Source:        "pico",
					CleanupPolicy: media.CleanupPolicyDeleteOnCleanup,
				}, scope); err == nil {
					ref = r
				}
			}

			uploadedFiles = append(uploadedFiles, workspaceUploadItem{
				Filename: safeName,
				Path:     targetPath,
				Size:     copied,
				Ref:      ref,
				URL:      "/api/workspace/file?path=" + base64.RawURLEncoding.EncodeToString([]byte(targetPath)),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(workspaceUploadResponse{
		Success: true,
		Files:   uploadedFiles,
	})
}

func (h *Handler) handleWorkspaceFileServe(w http.ResponseWriter, r *http.Request) {
	filePath := strings.TrimSpace(r.URL.Query().Get("path"))
	if filePath == "" {
		filePath = strings.TrimSpace(r.URL.Query().Get("name"))
	}
	if filePath == "" {
		filePath = strings.TrimSpace(r.URL.Query().Get("p"))
	}
	if filePath != "" {
		if decoded, err := base64.RawURLEncoding.DecodeString(filePath); err == nil && len(decoded) > 0 {
			filePath = string(decoded)
		} else if decoded, err := base64.URLEncoding.DecodeString(filePath); err == nil && len(decoded) > 0 {
			filePath = string(decoded)
		} else if decoded, err := base64.StdEncoding.DecodeString(filePath); err == nil && len(decoded) > 0 {
			filePath = string(decoded)
		} else if decoded, err := base64.RawStdEncoding.DecodeString(filePath); err == nil && len(decoded) > 0 {
			filePath = string(decoded)
		}
	}
	if filePath == "" {
		ref := strings.TrimSpace(r.URL.Query().Get("ref"))
		if ref != "" {
			if store := h.GetMediaStore(); store != nil {
				if resolved, err := store.Resolve(ref); err == nil {
					filePath = resolved
				}
			}
		}
	}

	if filePath == "" {
		http.Error(w, "missing path or ref parameter", http.StatusBadRequest)
		return
	}

	// Clean and validate target path
	cleanPath := filepath.Clean(filePath)
	mediaDir := filepath.Clean(media.TempDir())
	osTmp := filepath.Clean(os.TempDir())

	var workspaceDir string
	if cfg, err := config.LoadConfig(h.configPath); err == nil && cfg != nil {
		workspaceDir = filepath.Clean(cfg.WorkspacePath())
	}
	if workspaceDir == "" {
		home, _ := os.UserHomeDir()
		workspaceDir = filepath.Clean(filepath.Join(home, ".picoclaw", "workspace"))
	}

	// If relative or just a filename, check in workspace uploads, workspace, then mediaDir
	if !filepath.IsAbs(cleanPath) {
		cand := filepath.Join(workspaceDir, "uploads", cleanPath)
		if _, err := os.Stat(cand); err == nil {
			cleanPath = cand
		} else if cand := filepath.Join(workspaceDir, cleanPath); func() bool { _, err := os.Stat(cand); return err == nil }() {
			cleanPath = cand
		} else if cand := filepath.Join(mediaDir, cleanPath); func() bool { _, err := os.Stat(cand); return err == nil }() {
			cleanPath = cand
		} else if cand := filepath.Join(mediaDir, filepath.Base(cleanPath)); func() bool { _, err := os.Stat(cand); return err == nil }() {
			cleanPath = cand
		}
	}

	// Security check: ensure path is inside media directory, os.TempDir, or workspace
	if !strings.HasPrefix(cleanPath, mediaDir) && !strings.HasPrefix(cleanPath, osTmp) && !strings.HasPrefix(cleanPath, workspaceDir) {
		http.Error(w, "access denied: outside workspace or media directory", http.StatusForbidden)
		return
	}

	info, err := os.Stat(cleanPath)
	if err != nil || info.IsDir() {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	// Set inline header so browsers can preview pdf, images, text, etc.
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", cleanAttachmentFilename(filepath.Base(cleanPath))))

	// Explicit MIME types prevent Windows registry or content sniffing mismatches
	ext := strings.ToLower(filepath.Ext(cleanPath))
	switch ext {
	case ".pdf":
		w.Header().Set("Content-Type", "application/pdf")
	case ".json":
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
	case ".js", ".mjs":
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".html", ".htm":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".webp":
		w.Header().Set("Content-Type", "image/webp")
	case ".mp4":
		w.Header().Set("Content-Type", "video/mp4")
	case ".webm":
		w.Header().Set("Content-Type", "video/webm")
	case ".mp3":
		w.Header().Set("Content-Type", "audio/mpeg")
	case ".wav":
		w.Header().Set("Content-Type", "audio/wav")
	case ".ogg":
		w.Header().Set("Content-Type", "audio/ogg")
	case ".txt", ".md", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".c", ".cpp", ".h", ".hpp", ".cs", ".java", ".kt", ".swift", ".php", ".rb", ".sh", ".bash", ".zsh", ".yaml", ".yml", ".toml", ".ini", ".conf", ".sql", ".log":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	default:
		if mimeType := mime.TypeByExtension(ext); mimeType != "" {
			w.Header().Set("Content-Type", mimeType)
		}
	}

	http.ServeFile(w, r, cleanPath)
}
