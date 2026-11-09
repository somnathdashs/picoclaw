//go:build linux

package api

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

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
	var totalKB, availKB uint64
	if f, err := os.Open("/proc/meminfo"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			fields := strings.Fields(scanner.Text())
			if len(fields) >= 2 {
				key := strings.TrimSuffix(fields[0], ":")
				val, _ := strconv.ParseUint(fields[1], 10, 64)
				switch key {
				case "MemTotal":
					totalKB = val
				case "MemAvailable":
					availKB = val
				case "MemFree":
					if availKB == 0 {
						availKB = val
					}
				}
			}
		}
	}

	totalBytes := totalKB * 1024
	freeBytes := availKB * 1024
	usedBytes := uint64(0)
	if totalBytes >= freeBytes {
		usedBytes = totalBytes - freeBytes
	}

	picoBytes := getLinuxProcessRss(os.Getpid())
	if gatewayPID > 0 {
		picoBytes += getLinuxProcessRss(gatewayPID)
	}
	if picoBytes == 0 {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		picoBytes = m.Sys
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

func getLinuxProcessRss(pid int) uint64 {
	path := fmt.Sprintf("/proc/%d/statm", pid)
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) >= 2 {
		if pages, err := strconv.ParseUint(fields[1], 10, 64); err == nil {
			pageSize := uint64(os.Getpagesize())
			if pageSize == 0 {
				pageSize = 4096
			}
			return pages * pageSize
		}
	}
	return 0
}

func getDeviceTemperature() TemperatureState {
	// Look for thermal zones in /sys/class/thermal
	entries, err := filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	if err == nil && len(entries) > 0 {
		var maxMilli float64
		for _, entry := range entries {
			if data, err := os.ReadFile(entry); err == nil {
				if val, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64); err == nil && val > 0 {
					if val > maxMilli {
						maxMilli = val
					}
				}
			}
		}
		if maxMilli > 0 {
			celsius := maxMilli
			if celsius > 1000 {
				celsius = celsius / 1000.0
			}
			celsius = roundPercent(celsius)
			fahrenheit := roundPercent((celsius * 9.0 / 5.0) + 32.0)
			status := "normal"
			if celsius > 75 {
				status = "hot"
			} else if celsius > 55 {
				status = "warm"
			}
			return TemperatureState{
				Celsius:    celsius,
				Fahrenheit: fahrenheit,
				Available:  true,
				Status:     status,
			}
		}
	}

	// Fallback to hwmon
	hwEntries, _ := filepath.Glob("/sys/class/hwmon/hwmon*/temp*_input")
	if len(hwEntries) > 0 {
		var maxMilli float64
		for _, entry := range hwEntries {
			if data, err := os.ReadFile(entry); err == nil {
				if val, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64); err == nil && val > 0 {
					if val > maxMilli {
						maxMilli = val
					}
				}
			}
		}
		if maxMilli > 0 {
			celsius := roundPercent(maxMilli / 1000.0)
			fahrenheit := roundPercent((celsius * 9.0 / 5.0) + 32.0)
			status := "normal"
			if celsius > 75 {
				status = "hot"
			} else if celsius > 55 {
				status = "warm"
			}
			return TemperatureState{
				Celsius:    celsius,
				Fahrenheit: fahrenheit,
				Available:  true,
				Status:     status,
			}
		}
	}

	return TemperatureState{
		Available: false,
		Status:    "unavailable",
	}
}

