package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sipeed/picoclaw/pkg/media"
)

func TestWorkspaceUpload(t *testing.T) {
	handler := NewHandler("")
	mux := http.NewServeMux()
	handler.registerWorkspaceRoutes(mux)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "testfile.txt")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := part.Write([]byte("hello workspace")); err != nil {
		t.Fatalf("failed to write content: %v", err)
	}
	writer.Close()

	req := httptest.NewRequest("POST", "/api/workspace/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp workspaceUploadResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !resp.Success || len(resp.Files) != 1 {
		t.Fatalf("expected success with 1 file, got %+v", resp)
	}

	item := resp.Files[0]
	if item.Filename != "testfile.txt" {
		t.Errorf("expected filename 'testfile.txt', got %q", item.Filename)
	}

	if !strings.HasPrefix(filepath.Clean(item.Path), filepath.Clean(media.TempDir())) {
		t.Errorf("expected path to be inside media.TempDir(), got %q", item.Path)
	}

	if !strings.HasPrefix(item.Ref, "media://") {
		t.Errorf("expected ref to start with 'media://', got %q", item.Ref)
	}

	resolvedPath, err := handler.GetMediaStore().Resolve(item.Ref)
	if err != nil {
		t.Fatalf("failed to resolve media ref: %v", err)
	}
	if resolvedPath != item.Path {
		t.Errorf("resolved path %q != item.Path %q", resolvedPath, item.Path)
	}

	savedContent, err := os.ReadFile(item.Path)
	if err != nil {
		t.Fatalf("failed to read saved file: %v", err)
	}
	if string(savedContent) != "hello workspace" {
		t.Errorf("unexpected content %q", string(savedContent))
	}
	_ = os.Remove(item.Path)
}
