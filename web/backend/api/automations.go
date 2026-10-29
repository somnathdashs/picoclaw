package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/cron"
	"github.com/sipeed/picoclaw/pkg/logger"
)

// registerAutomationRoutes binds automation endpoints to the ServeMux.
func (h *Handler) registerAutomationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/automations", h.handleListAutomations)
	mux.HandleFunc("POST /api/automations", h.handleCreateAutomation)
	mux.HandleFunc("GET /api/automations/{id}", h.handleGetAutomation)
	mux.HandleFunc("PUT /api/automations/{id}", h.handleUpdateAutomation)
	mux.HandleFunc("DELETE /api/automations/{id}", h.handleDeleteAutomation)
	mux.HandleFunc("POST /api/automations/{id}/toggle", h.handleToggleAutomation)
	mux.HandleFunc("POST /api/automations/{id}/run", h.handleRunAutomation)
}

func (h *Handler) getCronService() (*cron.CronService, error) {
	cfg, err := config.LoadConfig(h.configPath)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	cronStorePath := filepath.Join(cfg.WorkspacePath(), "cron", "jobs.json")
	return cron.NewCronService(cronStorePath, nil), nil
}

func (h *Handler) handleListAutomations(w http.ResponseWriter, r *http.Request) {
	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jobs := cs.ListJobs(true)
	status := cs.Status()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"jobs":   jobs,
		"status": status,
		"count":  len(jobs),
	})
}

type createAutomationRequest struct {
	Name           string            `json:"name"`
	Schedule       cron.CronSchedule `json:"schedule"`
	Payload        cron.CronPayload  `json:"payload"`
	Enabled        *bool             `json:"enabled,omitempty"`
	DeleteAfterRun *bool             `json:"deleteAfterRun,omitempty"`
}

func (h *Handler) handleCreateAutomation(w http.ResponseWriter, r *http.Request) {
	var req createAutomationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		req.Name = "Scheduled Task"
	}
	if req.Payload.Message == "" && req.Payload.Command == "" {
		http.Error(w, "either message or command is required", http.StatusBadRequest)
		return
	}
	if req.Payload.Kind == "" {
		req.Payload.Kind = "agent_turn"
	}

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	job, err := cs.AddJob(
		req.Name,
		req.Schedule,
		req.Payload.Message,
		req.Payload.Channel,
		req.Payload.To,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	needsUpdate := false
	if req.Payload.Command != "" {
		job.Payload.Command = req.Payload.Command
		needsUpdate = true
	}
	if req.Enabled != nil && *req.Enabled != job.Enabled {
		job.Enabled = *req.Enabled
		needsUpdate = true
	}
	if req.DeleteAfterRun != nil {
		job.DeleteAfterRun = *req.DeleteAfterRun
		needsUpdate = true
	}
	if needsUpdate {
		_ = cs.UpdateJob(job)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(job)
}

func (h *Handler) handleGetAutomation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	job, ok := cs.GetJob(id)
	if !ok {
		http.Error(w, "automation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(job)
}

func (h *Handler) handleUpdateAutomation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var req createAutomationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	job, ok := cs.GetJob(id)
	if !ok {
		http.Error(w, "automation not found", http.StatusNotFound)
		return
	}

	if req.Name != "" {
		job.Name = req.Name
	}
	if req.Schedule.Kind != "" {
		job.Schedule = req.Schedule
	}
	if req.Payload.Message != "" {
		job.Payload.Message = req.Payload.Message
	}
	if req.Payload.Command != "" {
		job.Payload.Command = req.Payload.Command
	}
	if req.Payload.Channel != "" {
		job.Payload.Channel = req.Payload.Channel
	}
	if req.Payload.To != "" {
		job.Payload.To = req.Payload.To
	}
	if req.Enabled != nil {
		job.Enabled = *req.Enabled
	}
	if req.DeleteAfterRun != nil {
		job.DeleteAfterRun = *req.DeleteAfterRun
	}

	if err := cs.UpdateJob(job); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	updated, _ := cs.GetJob(id)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *Handler) handleDeleteAutomation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !cs.RemoveJob(id) {
		http.Error(w, "automation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
}

func (h *Handler) handleToggleAutomation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var req struct {
		Enabled *bool `json:"enabled,omitempty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	job, ok := cs.GetJob(id)
	if !ok {
		http.Error(w, "automation not found", http.StatusNotFound)
		return
	}

	nextEnabled := !job.Enabled
	if req.Enabled != nil {
		nextEnabled = *req.Enabled
	}

	updated := cs.EnableJob(id, nextEnabled)
	if updated == nil {
		http.Error(w, "failed to update automation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *Handler) handleRunAutomation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	cs, err := h.getCronService()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	job, ok := cs.GetJob(id)
	if !ok {
		http.Error(w, "automation not found", http.StatusNotFound)
		return
	}

	now := time.Now().UnixMilli()
	job.State.LastRunAtMS = &now
	job.State.LastStatus = "running"
	job.State.History = append([]cron.CronRunRecord{{
		RunAtMS:    now,
		DurationMS: 0,
		Status:     "running",
	}}, job.State.History...)
	if len(job.State.History) > 20 {
		job.State.History = job.State.History[:20]
	}
	_ = cs.UpdateJob(job)

	logger.InfoCF("automations", "Manually triggered automation job", map[string]any{
		"id":      job.ID,
		"name":    job.Name,
		"command": job.Payload.Command,
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "Automation triggered successfully",
		"job":     job,
	})
}
