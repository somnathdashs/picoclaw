package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/cron"
	"github.com/sipeed/picoclaw/pkg/logger"
	"github.com/sipeed/picoclaw/web/backend/utils"
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
		if req.Payload.Deliver {
			req.Payload.Kind = "reminder"
		} else if req.Payload.Command != "" {
			req.Payload.Kind = "command"
		} else {
			req.Payload.Kind = "agent_turn"
		}
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
	if req.Payload.Kind != "" && req.Payload.Kind != job.Payload.Kind {
		job.Payload.Kind = req.Payload.Kind
		needsUpdate = true
	}
	if req.Payload.Deliver != job.Payload.Deliver {
		job.Payload.Deliver = req.Payload.Deliver
		needsUpdate = true
	}
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
	if req.Payload.Kind != "" {
		job.Payload.Kind = req.Payload.Kind
	}
	job.Payload.Deliver = req.Payload.Deliver
	if req.Payload.Deliver && job.Payload.Kind == "" {
		job.Payload.Kind = "reminder"
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

	startTime := time.Now().UnixMilli()
	var runErr error
	var outputStr string

	command := strings.TrimSpace(job.Payload.Command)
	if command != "" {
		cfg, _ := config.LoadConfig(h.configPath)
		var workDir string
		if cfg != nil {
			workDir = cfg.WorkspacePath()
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
		defer cancel()

		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.CommandContext(ctx, "cmd", "/c", command)
			applyLauncherProcAttrs(cmd)
		} else {
			cmd = exec.CommandContext(ctx, "sh", "-c", command)
		}
		if workDir != "" {
			cmd.Dir = workDir
		}

		outBytes, err := cmd.CombinedOutput()
		outputStr = string(outBytes)
		if err != nil {
			runErr = err
		}
	} else if job.Payload.Kind == "reminder" || job.Payload.Deliver {
		target := job.Payload.Channel
		if target == "" || target == "cli" {
			target = "local"
		}
		if job.Payload.To != "" {
			target = fmt.Sprintf("%s (%s)", target, job.Payload.To)
		}
		outputStr = fmt.Sprintf("Reminder [%s]: %s", target, job.Payload.Message)
	} else {
		bin := utils.FindPicoclawBinary()
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
		defer cancel()

		sessionKey := fmt.Sprintf("agent:cron-%s", job.ID)
		cmd := exec.CommandContext(ctx, bin, "agent", "-m", job.Payload.Message, "-s", sessionKey)
		applyLauncherProcAttrs(cmd)

		cfg, _ := config.LoadConfig(h.configPath)
		var workDir string
		if cfg != nil {
			workDir = cfg.WorkspacePath()
		}
		if workDir != "" {
			cmd.Dir = workDir
			logDir := filepath.Join(filepath.Dir(workDir), "logs")
			_ = os.MkdirAll(logDir, 0o755)
			cmd.Env = append(os.Environ(), "PICOCLAW_LOG_FILE="+filepath.Join(logDir, "agent-cron.log"))
		}

		outBytes, err := cmd.CombinedOutput()
		if err != nil {
			runErr = err
			outputStr = string(outBytes)
		} else {
			rawOutput := string(outBytes)
			if idx := strings.Index(rawOutput, "🦞"); idx != -1 {
				outputStr = strings.TrimSpace(rawOutput[idx+len("🦞"):])
			} else {
				outputStr = strings.TrimSpace(rawOutput)
			}
			if outputStr == "" {
				outputStr = "Agent prompt executed successfully (empty response)"
			}
		}
	}

	duration := time.Now().UnixMilli() - startTime
	status := "ok"
	errStr := ""
	if runErr != nil {
		status = "error"
		errStr = runErr.Error()
	}

	job.State.LastRunAtMS = &startTime
	job.State.LastStatus = status
	job.State.LastError = errStr
	job.State.LastOutput = outputStr

	record := cron.CronRunRecord{
		RunAtMS:    startTime,
		DurationMS: duration,
		Status:     status,
		Error:      errStr,
		Output:     outputStr,
	}
	job.State.History = append([]cron.CronRunRecord{record}, job.State.History...)
	if len(job.State.History) > 20 {
		job.State.History = job.State.History[:20]
	}

	if err := cs.UpdateJob(job); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	logger.InfoCF("automations", "Manually executed automation job", map[string]any{
		"id":      job.ID,
		"name":    job.Name,
		"status":  status,
		"command": job.Payload.Command,
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": runErr == nil,
		"message": "Automation executed successfully",
		"job":     job,
	})
}
