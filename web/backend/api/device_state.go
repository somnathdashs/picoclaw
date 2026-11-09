package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/sipeed/picoclaw/pkg/config"
)

// StorageState contains storage capacity and PicoClaw disk footprint.
type StorageState struct {
	TotalBytes      uint64  `json:"total_bytes"`
	FreeBytes       uint64  `json:"free_bytes"`
	UsedBytes       uint64  `json:"used_bytes"`
	UsedPercent     float64 `json:"used_percent"`
	PicoclawBytes   uint64  `json:"picoclaw_bytes"`
	PicoclawPercent float64 `json:"picoclaw_percent"`
}

// RamState contains system memory metrics and PicoClaw memory usage.
type RamState struct {
	TotalBytes      uint64  `json:"total_bytes"`
	FreeBytes       uint64  `json:"free_bytes"`
	UsedBytes       uint64  `json:"used_bytes"`
	UsedPercent     float64 `json:"used_percent"`
	PicoclawBytes   uint64  `json:"picoclaw_bytes"`
	PicoclawPercent float64 `json:"picoclaw_percent"`
}

// TemperatureState contains thermal sensor telemetry and status.
type TemperatureState struct {
	Celsius    float64 `json:"celsius"`
	Fahrenheit float64 `json:"fahrenheit"`
	Available  bool    `json:"available"`
	Status     string  `json:"status"` // "normal", "warm", "hot", "unavailable"
}

// DeviceStateResponse is the full device state payload.
type DeviceStateResponse struct {
	Storage       StorageState     `json:"storage"`
	RAM           RamState         `json:"ram"`
	Temperature   TemperatureState `json:"temperature"`
	OS            string           `json:"os"`
	Arch          string           `json:"arch"`
	NumCPU        int              `json:"num_cpu"`
	UptimeSeconds int64            `json:"uptime_seconds"`
}

var (
	deviceStateStartTime = time.Now()
	diskSizeCacheMu      sync.RWMutex
	cachedPicoDiskBytes  uint64
	lastDiskScanTime     time.Time
	diskScanInProgress   bool
)

func (h *Handler) registerDeviceStateRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/system/device-state", h.handleGetDeviceState)
}

func (h *Handler) handleGetDeviceState(w http.ResponseWriter, r *http.Request) {
	state := h.collectDeviceState()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(state); err != nil {
		http.Error(w, "Failed to encode device state", http.StatusInternalServerError)
	}
}

func (h *Handler) collectDeviceState() DeviceStateResponse {
	storage := getSystemStorageMetrics(h.getStorageProbePath())
	picoDisk := getCachedPicoStorageBytes(h)
	storage.PicoclawBytes = picoDisk
	if storage.TotalBytes > 0 {
		storage.PicoclawPercent = roundPercent(float64(picoDisk) / float64(storage.TotalBytes) * 100.0)
	}

	gatewayPID := 0
	gateway.mu.Lock()
	if gateway.pidData != nil {
		gatewayPID = gateway.pidData.PID
	}
	gateway.mu.Unlock()

	ram := getSystemRamMetrics(gatewayPID)
	temp := getDeviceTemperature()

	return DeviceStateResponse{
		Storage:       storage,
		RAM:           ram,
		Temperature:   temp,
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		NumCPU:        runtime.NumCPU(),
		UptimeSeconds: int64(time.Since(deviceStateStartTime).Seconds()),
	}
}

func (h *Handler) getStorageProbePath() string {
	cfg, err := config.LoadConfig(h.configPath)
	if err == nil && cfg != nil && cfg.Agents.Defaults.Workspace != "" {
		return cfg.Agents.Defaults.Workspace
	}
	return config.GetHome()
}

func getCachedPicoStorageBytes(h *Handler) uint64 {
	diskSizeCacheMu.RLock()
	cached := cachedPicoDiskBytes
	lastScan := lastDiskScanTime
	inProg := diskScanInProgress
	diskSizeCacheMu.RUnlock()

	if time.Since(lastScan) < 45*time.Second && lastScan.After(time.Time{}) {
		return cached
	}

	if !inProg {
		go calculatePicoStorageAsync(h)
	}
	return cached
}

func calculatePicoStorageAsync(h *Handler) {
	diskSizeCacheMu.Lock()
	if diskScanInProgress {
		diskSizeCacheMu.Unlock()
		return
	}
	diskScanInProgress = true
	diskSizeCacheMu.Unlock()

	defer func() {
		diskSizeCacheMu.Lock()
		diskScanInProgress = false
		diskSizeCacheMu.Unlock()
	}()

	homeDir := config.GetHome()
	var total uint64 = computeDirSize(homeDir)

	ws := h.getStorageProbePath()
	if ws != "" && ws != homeDir && !filepath.HasPrefix(ws, homeDir) {
		total += computeDirSize(ws)
	}

	diskSizeCacheMu.Lock()
	cachedPicoDiskBytes = total
	lastDiskScanTime = time.Now()
	diskSizeCacheMu.Unlock()
}

func computeDirSize(root string) uint64 {
	var size uint64
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() && (d.Name() == ".git" || d.Name() == "node_modules") {
			return filepath.SkipDir
		}
		if !d.IsDir() {
			if info, err := d.Info(); err == nil {
				size += uint64(info.Size())
			}
		}
		return nil
	})
	return size
}

func roundPercent(val float64) float64 {
	return float64(int(val*10+0.5)) / 10
}

