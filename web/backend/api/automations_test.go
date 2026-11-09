package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/cron"
)

func setupAutomationsTest(t *testing.T) (*Handler, *http.ServeMux, string) {
	t.Helper()
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.json")
	workspace := filepath.Join(tempDir, "workspace")

	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = workspace
	if err := os.MkdirAll(filepath.Join(workspace, "cron"), 0o755); err != nil {
		t.Fatalf("failed to create workspace: %v", err)
	}
	if err := config.SaveConfig(configPath, cfg); err != nil {
		t.Fatalf("failed to save config: %v", err)
	}

	h := NewHandler(configPath)
	mux := http.NewServeMux()
	h.registerAutomationRoutes(mux)

	return h, mux, workspace
}

func TestRunAutomation_Command(t *testing.T) {
	h, mux, workspace := setupAutomationsTest(t)
	cronPath := filepath.Join(workspace, "cron", "jobs.json")
	cs := cron.NewCronService(cronPath, nil)

	job, err := cs.AddJob("Echo test", cron.CronSchedule{Kind: "every", EveryMS: int64Ptr(3600000)}, "echo hello", "cli", "direct")
	if err != nil {
		t.Fatalf("failed to add job: %v", err)
	}
	job.Payload.Command = "echo run_command_ok"
	job.Payload.Kind = "command"
	_ = cs.UpdateJob(job)

	req := httptest.NewRequest(http.MethodPost, "/api/automations/"+job.ID+"/run", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	freshCs := cron.NewCronService(cronPath, nil)
	freshJob, ok := freshCs.GetJob(job.ID)
	if !ok {
		t.Fatal("job not found after run")
	}
	if freshJob.State.LastStatus != "ok" {
		t.Fatalf("lastStatus = %q, want 'ok'", freshJob.State.LastStatus)
	}
	if !strings.Contains(freshJob.State.LastOutput, "run_command_ok") {
		t.Fatalf("lastOutput = %q, want 'run_command_ok'", freshJob.State.LastOutput)
	}
	if len(freshJob.State.History) == 0 || freshJob.State.History[0].Status != "ok" {
		t.Fatalf("history invalid: %+v", freshJob.State.History)
	}
	_ = h
}

func TestRunAutomation_Reminder(t *testing.T) {
	_, mux, workspace := setupAutomationsTest(t)
	cronPath := filepath.Join(workspace, "cron", "jobs.json")
	cs := cron.NewCronService(cronPath, nil)

	job, err := cs.AddJob("Sleep Reminder", cron.CronSchedule{Kind: "at"}, "Time to sleep", "cli", "direct")
	if err != nil {
		t.Fatalf("failed to add job: %v", err)
	}
	job.Payload.Kind = "reminder"
	job.Payload.Deliver = true
	_ = cs.UpdateJob(job)

	req := httptest.NewRequest(http.MethodPost, "/api/automations/"+job.ID+"/run", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	freshCs := cron.NewCronService(cronPath, nil)
	freshJob, ok := freshCs.GetJob(job.ID)
	if !ok {
		t.Fatal("job not found after run")
	}
	if freshJob.State.LastStatus != "ok" {
		t.Fatalf("lastStatus = %q, want 'ok'", freshJob.State.LastStatus)
	}
	if !strings.Contains(freshJob.State.LastOutput, "Time to sleep") {
		t.Fatalf("lastOutput = %q, want 'Time to sleep'", freshJob.State.LastOutput)
	}
}

func TestRunAutomation_AgentPrompt(t *testing.T) {
	_, mux, workspace := setupAutomationsTest(t)
	cronPath := filepath.Join(workspace, "cron", "jobs.json")
	cs := cron.NewCronService(cronPath, nil)

	job, err := cs.AddJob("Agent Briefing", cron.CronSchedule{Kind: "every", EveryMS: int64Ptr(3600000)}, "Say hello", "cli", "direct")
	if err != nil {
		t.Fatalf("failed to add job: %v", err)
	}
	job.Payload.Kind = "agent_turn"
	_ = cs.UpdateJob(job)

	req := httptest.NewRequest(http.MethodPost, "/api/automations/"+job.ID+"/run", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	freshCs := cron.NewCronService(cronPath, nil)
	freshJob, ok := freshCs.GetJob(job.ID)
	if !ok {
		t.Fatal("job not found after run")
	}
	if freshJob.State.LastStatus != "ok" {
		t.Fatalf("lastStatus = %q, want 'ok'", freshJob.State.LastStatus)
	}
	if freshJob.State.LastOutput == "" {
		t.Fatal("lastOutput should not be empty")
	}
}

func int64Ptr(v int64) *int64 {
	return &v
}

func TestRunAutomation_NotFound(t *testing.T) {
	_, mux, _ := setupAutomationsTest(t)

	req := httptest.NewRequest(http.MethodPost, "/api/automations/nonexistent_id/run", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
