//go:build !windows && !linux && !darwin

package api

import (
	"runtime"
)

func getSystemStorageMetrics(probePath string) StorageState {
	return StorageState{}
}

func getSystemRamMetrics(gatewayPID int) RamState {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return RamState{
		TotalBytes:    m.Sys * 2,
		FreeBytes:     m.Sys,
		UsedBytes:     m.Sys,
		UsedPercent:   50.0,
		PicoclawBytes: m.Alloc,
	}
}

func getDeviceTemperature() TemperatureState {
	return TemperatureState{
		Available: false,
		Status:    "unavailable",
	}
}

