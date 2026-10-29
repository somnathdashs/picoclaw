package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/sipeed/picoclaw/pkg/config"
)

type rulesResponse struct {
	Path      string `json:"path"`
	Content   string `json:"content"`
	Exists    bool   `json:"exists"`
	UpdatedAt int64  `json:"updated_at,omitempty"`
}

type updateRulesRequest struct {
	Content string `json:"content"`
}

func (h *Handler) registerRulesRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/rules", h.handleGetRules)
	mux.HandleFunc("PUT /api/rules", h.handleUpdateRules)
	mux.HandleFunc("DELETE /api/rules", h.handleResetRules)
}

func (h *Handler) resolveRulesPath() (string, error) {
	cfg, err := config.LoadConfig(h.configPath)
	if err != nil {
		return "", fmt.Errorf("failed to load config: %w", err)
	}
	return filepath.Join(cfg.WorkspacePath(), "RULES.md"), nil
}

func (h *Handler) handleGetRules(w http.ResponseWriter, r *http.Request) {
	rulePath, err := h.resolveRulesPath()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	info, err := os.Stat(rulePath)
	if os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(rulesResponse{
			Path:    "RULES.md",
			Content: "",
			Exists:  false,
		})
		return
	} else if err != nil {
		http.Error(w, fmt.Sprintf("Failed to check rules file: %v", err), http.StatusInternalServerError)
		return
	}

	content, err := os.ReadFile(rulePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read rules file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rulesResponse{
		Path:      "RULES.md",
		Content:   string(content),
		Exists:    true,
		UpdatedAt: info.ModTime().Unix(),
	})
}

func (h *Handler) handleUpdateRules(w http.ResponseWriter, r *http.Request) {
	rulePath, err := h.resolveRulesPath()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req updateRulesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request payload: %v", err), http.StatusBadRequest)
		return
	}

	dir := filepath.Dir(rulePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create workspace directory: %v", err), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(rulePath, []byte(req.Content), 0o644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save rules file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rulesResponse{
		Path:      "RULES.md",
		Content:   req.Content,
		Exists:    true,
		UpdatedAt: time.Now().Unix(),
	})
}

func (h *Handler) handleResetRules(w http.ResponseWriter, r *http.Request) {
	rulePath, err := h.resolveRulesPath()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.Remove(rulePath); err != nil && !os.IsNotExist(err) {
		http.Error(w, fmt.Sprintf("Failed to reset rules file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rulesResponse{
		Path:    "RULES.md",
		Content: "",
		Exists:  false,
	})
}
