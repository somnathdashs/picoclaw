package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/sipeed/picoclaw/pkg/config"
)

func setupRulesTest(t *testing.T) (*Handler, *http.ServeMux, string) {
	t.Helper()
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.json")
	workspace := filepath.Join(tempDir, "workspace")

	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = workspace
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatalf("failed to create workspace: %v", err)
	}
	if err := config.SaveConfig(configPath, cfg); err != nil {
		t.Fatalf("failed to save config: %v", err)
	}

	h := NewHandler(configPath)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	return h, mux, workspace
}

func TestGetRulesEmptyWhenNoFile(t *testing.T) {
	_, mux, _ := setupRulesTest(t)

	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var resp rulesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json unmarshal error: %v", err)
	}

	if resp.Exists {
		t.Fatal("expected exists = false")
	}
	if resp.Content != "" {
		t.Fatalf("expected empty content, got %q", resp.Content)
	}
	if resp.Path != "RULES.md" {
		t.Fatalf("expected path RULES.md, got %q", resp.Path)
	}
}

func TestUpdateAndGetRules(t *testing.T) {
	_, mux, workspace := setupRulesTest(t)

	payload := updateRulesRequest{
		Content: "# Global Rules\n- Be concise\n- Follow instructions",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPut, "/api/rules", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("PUT status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	saved, err := os.ReadFile(filepath.Join(workspace, "RULES.md"))
	if err != nil {
		t.Fatalf("failed to read RULES.md from disk: %v", err)
	}
	if string(saved) != payload.Content {
		t.Fatalf("disk content = %q, want %q", string(saved), payload.Content)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	getRec := httptest.NewRecorder()
	mux.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", getRec.Code, http.StatusOK)
	}

	var resp rulesResponse
	if err := json.Unmarshal(getRec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json unmarshal error: %v", err)
	}

	if !resp.Exists {
		t.Fatal("expected exists = true after update")
	}
	if resp.Content != payload.Content {
		t.Fatalf("content = %q, want %q", resp.Content, payload.Content)
	}
}

func TestResetRules(t *testing.T) {
	_, mux, workspace := setupRulesTest(t)

	rulesPath := filepath.Join(workspace, "RULES.md")
	if err := os.WriteFile(rulesPath, []byte("Some rules"), 0o644); err != nil {
		t.Fatalf("failed to write test rules: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/rules", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE status = %d, want %d", rec.Code, http.StatusOK)
	}

	if _, err := os.Stat(rulesPath); !os.IsNotExist(err) {
		t.Fatalf("expected RULES.md to be deleted, err = %v", err)
	}
}
