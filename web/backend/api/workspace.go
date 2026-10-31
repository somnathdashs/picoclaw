package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/sipeed/picoclaw/pkg/channels"
	"github.com/sipeed/picoclaw/pkg/media"
	"github.com/sipeed/picoclaw/pkg/utils"
)

type workspaceUploadItem struct {
	Filename string `json:"filename"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	Ref      string `json:"ref,omitempty"`
}

type workspaceUploadResponse struct {
	Success bool                  `json:"success"`
	Files   []workspaceUploadItem `json:"files"`
	Message string                `json:"message,omitempty"`
}

func (h *Handler) registerWorkspaceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/workspace/upload", h.handleWorkspaceUpload)
}

func (h *Handler) handleWorkspaceUpload(w http.ResponseWriter, r *http.Request) {
	mediaDir := media.TempDir()
	if err := os.MkdirAll(mediaDir, 0o700); err != nil {
		http.Error(w, fmt.Sprintf("Failed to ensure media directory: %v", err), http.StatusInternalServerError)
		return
	}

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

			localPath := filepath.Join(mediaDir, uuid.New().String()[:8]+"_"+safeName)
			dst, err := os.Create(localPath)
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
				_ = os.Remove(localPath)
				http.Error(w, fmt.Sprintf("Failed to write file %s: %v", safeName, err), http.StatusInternalServerError)
				return
			}

			contentType := fileHeader.Header.Get("Content-Type")
			if contentType == "" {
				contentType = "application/octet-stream"
			}

			ref := localPath
			if store != nil {
				scope := channels.BuildMediaScope("pico", "upload", uuid.New().String())
				if r, err := store.Store(localPath, media.MediaMeta{
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
				Path:     localPath,
				Size:     copied,
				Ref:      ref,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(workspaceUploadResponse{
		Success: true,
		Files:   uploadedFiles,
	})
}
