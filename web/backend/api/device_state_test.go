package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestHandleGetDeviceState(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.json")
	h := NewHandler(configPath)

	mux := http.NewServeMux()
	h.registerDeviceStateRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/system/device-state", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var res DeviceStateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.OS == "" {
		t.Errorf("expected non-empty OS")
	}
	if res.Arch == "" {
		t.Errorf("expected non-empty Arch")
	}
	if res.NumCPU <= 0 {
		t.Errorf("expected NumCPU > 0, got %d", res.NumCPU)
	}
}

