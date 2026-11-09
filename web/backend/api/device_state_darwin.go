//go:build darwin

package api

import (
	"runtime"

	"golang.org/x/sys/unix"
)

func getSystemStorageMetrics(probePath string) StorageState {
	target := probePath
	if target == "" {
		target = "/"
	}
	var stat unix.Statfs_t
	if err := unix.Statfs(target, &stat); err == nil {
		total := stat.Blocks * uint64(stat.Bsize)
		free := stat.Bavail * uint64(stat.Bsize)
		used := uint64(0)
		if total >= free {
			used = total - free
		}
		var pct float64
		if total > 0 {
			pct = roundPercent(float64(used) / float64(total) * 100.0)
		}
		return StorageState{
			TotalBytes:  total,
			FreeBytes:   free,
			UsedBytes:   used,
			UsedPercent: pct,
		}
	}
	return StorageState{}
}

func getSystemRamMetrics(gatewayPID int) RamState {
	var totalBytes, freeBytes, picoBytes uint64
	if mem, err := unix.SysctlUint64("hw.memsize"); err == nil {
		totalBytes = mem
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	picoBytes = m.Sys

	// Darwin fallback estimate
	if totalBytes > 0 {
		freeBytes = totalBytes / 2
	}
	usedBytes := uint64(0)
	if totalBytes >= freeBytes {
		usedBytes = totalBytes - freeBytes
	}

	var usedPct, picoPct float64
	if totalBytes > 0 {
		usedPct = roundPercent(float64(usedBytes) / float64(totalBytes) * 100.0)
		picoPct = roundPercent(float64(picoBytes) / float64(totalBytes) * 100.0)
	}

	return RamState{
		TotalBytes:      totalBytes,
		FreeBytes:       freeBytes,
		UsedBytes:       usedBytes,
		UsedPercent:     usedPct,
		PicoclawBytes:   picoBytes,
		PicoclawPercent: picoPct,
	}
}

func getDeviceTemperature() TemperatureState {
	return TemperatureState{
		Available: false,
		Status:    "unavailable",
	}
}

