package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"

	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/logger"
)

// registerWhatsAppRoutes registers WhatsApp endpoints.
func (h *Handler) registerWhatsAppRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/whatsapp/status", h.handleWhatsAppStatus)
	mux.HandleFunc("POST /api/whatsapp/unlink", h.handleWhatsAppUnlink)
	mux.HandleFunc("POST /api/whatsapp/link", h.handleWhatsAppLink)
}

func (h *Handler) getWhatsAppInfo() (bc *config.Channel, ws *config.WhatsAppSettings, storePath string, err error) {
	cfg, err := config.LoadConfig(h.configPath)
	if err != nil {
		return nil, nil, "", err
	}

	bc = cfg.Channels.Get(config.ChannelWhatsApp)
	if bc == nil {
		bc = cfg.Channels.Get(config.ChannelWhatsAppNative)
	}
	if bc == nil {
		bc = &config.Channel{Type: config.ChannelWhatsApp}
	}

	var s config.WhatsAppSettings
	if len(bc.Settings) > 0 {
		_ = json.Unmarshal(bc.Settings, &s)
	}
	ws = &s

	storePath = ws.SessionStorePath
	if storePath == "" {
		storePath = filepath.Join(cfg.WorkspacePath(), "whatsapp")
	}
	return bc, ws, storePath, nil
}

func (h *Handler) handleWhatsAppStatus(w http.ResponseWriter, r *http.Request) {
	bc, ws, storePath, err := h.getWhatsAppInfo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	dbPath := filepath.Join(storePath, "store.db")
	hasSessionFile := false
	linked := false
	var jid, phone, pushName string

	if fi, err := os.Stat(dbPath); err == nil && fi.Size() > 0 {
		hasSessionFile = true
		db, err := sql.Open("sqlite", "file:"+dbPath+"?mode=ro")
		if err == nil {
			row := db.QueryRow("SELECT jid, push_name FROM whatsmeow_device LIMIT 1")
			var rawJID, rawPush sql.NullString
			if err := row.Scan(&rawJID, &rawPush); err == nil && rawJID.Valid && rawJID.String != "" {
				jid = rawJID.String
				pushName = rawPush.String
				linked = true
				if parts := strings.Split(jid, "@"); len(parts) > 0 {
					phone = strings.Split(parts[0], ":")[0]
				}
			}
			_ = db.Close()
		}
	}

	status := h.gatewayStatusData()
	gwState, _ := status["gateway_status"].(string)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"enabled":            bc.Enabled,
		"use_native":         ws.UseNative,
		"bridge_url":         ws.BridgeURL,
		"session_store_path": storePath,
		"has_session_file":   hasSessionFile,
		"linked":             linked,
		"jid":                jid,
		"phone":              phone,
		"push_name":          pushName,
		"gateway_running":    gwState == "running",
	})
}

func (h *Handler) handleWhatsAppUnlink(w http.ResponseWriter, r *http.Request) {
	_, _, storePath, err := h.getWhatsAppInfo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	filesToRemove := []string{
		filepath.Join(storePath, "store.db"),
		filepath.Join(storePath, "store.db-wal"),
		filepath.Join(storePath, "store.db-shm"),
	}

	for _, file := range filesToRemove {
		_ = os.Remove(file)
	}

	logger.InfoCF("whatsapp", "Deleted WhatsApp session files", map[string]any{
		"store_path": storePath,
	})

	status := h.gatewayStatusData()
	if gwState, _ := status["gateway_status"].(string); gwState == "running" {
		_, _ = h.RestartGateway()
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "WhatsApp session deleted and unlinked",
	})
}

func (h *Handler) handleWhatsAppLink(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.LoadConfig(h.configPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	bc := cfg.Channels.Get(config.ChannelWhatsApp)
	if bc == nil {
		bc = &config.Channel{Type: config.ChannelWhatsApp}
		if cfg.Channels == nil {
			cfg.Channels = make(config.ChannelsConfig)
		}
		cfg.Channels[config.ChannelWhatsApp] = bc
	}
	bc.Enabled = true

	var s config.WhatsAppSettings
	if len(bc.Settings) > 0 {
		_ = json.Unmarshal(bc.Settings, &s)
	}
	s.UseNative = true
	settingsJSON, _ := json.Marshal(s)
	bc.Settings = settingsJSON

	if err := config.SaveConfig(h.configPath, cfg); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	status := h.gatewayStatusData()
	if gwState, _ := status["gateway_status"].(string); gwState == "running" {
		_, _ = h.RestartGateway()
	} else {
		_, _ = h.StartGateway()
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"message": "WhatsApp native linking initiated. Gateway is running.",
	})
}

