//go:build windows

package api

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/sipeed/picoclaw/web/backend/utils"
	"golang.org/x/sys/windows"
)

var (
	modKernel32              = windows.NewLazySystemDLL("kernel32.dll")
	procGlobalMemoryStatusEx = modKernel32.NewProc("GlobalMemoryStatusEx")
	modPsapi                 = windows.NewLazySystemDLL("psapi.dll")
	procGetProcessMemoryInfo = modPsapi.NewProc("GetProcessMemoryInfo")

	winTempMu        sync.Mutex
	lastWinTempCheck time.Time
	cachedWinTemp    TemperatureState
)

type winMemoryStatusEx struct {
	cbSize                  uint32
	memoryLoad              uint32
	totalPhys               uint64
	availPhys               uint64
	totalPageFile           uint64
	availPageFile           uint64
	totalVirtual            uint64
	availVirtual            uint64
	availExtendedVirtual    uint64
}

type winProcessMemoryCounters struct {
	cb                         uint32
	pageFaultCount             uint32
	peakWorkingSetSize         uintptr
	workingSetSize             uintptr
	quotaPeakPagedPoolUsage    uintptr
	quotaPagedPoolUsage        uintptr
	quotaPeakNonPagedPoolUsage uintptr
	quotaNonPagedPoolUsage     uintptr
	pagefileUsage              uintptr
	peakPagefileUsage          uintptr
}

func getSystemStorageMetrics(probePath string) StorageState {
	target := probePath
	if target == "" {
		target = os.Getenv("USERPROFILE")
	}
	vol := filepath.VolumeName(target)
	if vol == "" {
		vol = "C:"
	}
	dir := vol + `\`

	var freeAvail, totalBytes, totalFree uint64
	ptr, err := windows.UTF16PtrFromString(dir)
	if err == nil {
		if err := windows.GetDiskFreeSpaceEx(ptr, &freeAvail, &totalBytes, &totalFree); err == nil {
			used := totalBytes - freeAvail
			var pct float64
			if totalBytes > 0 {
				pct = roundPercent(float64(used) / float64(totalBytes) * 100.0)
			}
			return StorageState{
				TotalBytes:  totalBytes,
				FreeBytes:   freeAvail,
				UsedBytes:   used,
				UsedPercent: pct,
			}
		}
	}
	return StorageState{}
}

func getSystemRamMetrics(gatewayPID int) RamState {
	var totalPhys, availPhys, picoBytes uint64

	var mem winMemoryStatusEx
	mem.cbSize = uint32(unsafe.Sizeof(mem))
	if r1, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&mem))); r1 != 0 {
		totalPhys = mem.totalPhys
		availPhys = mem.availPhys
	}

	picoBytes = getProcessWorkingSet(windows.CurrentProcess())

	if gatewayPID > 0 {
		hProc, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(gatewayPID))
		if err == nil && hProc != 0 {
			defer windows.CloseHandle(hProc)
			picoBytes += getProcessWorkingSet(hProc)
		}
	}

	if picoBytes == 0 {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		picoBytes = m.Sys
	}

	usedPhys := uint64(0)
	if totalPhys >= availPhys {
		usedPhys = totalPhys - availPhys
	}

	var usedPct, picoPct float64
	if totalPhys > 0 {
		usedPct = roundPercent(float64(usedPhys) / float64(totalPhys) * 100.0)
		picoPct = roundPercent(float64(picoBytes) / float64(totalPhys) * 100.0)
	}

	return RamState{
		TotalBytes:      totalPhys,
		FreeBytes:       availPhys,
		UsedBytes:       usedPhys,
		UsedPercent:     usedPct,
		PicoclawBytes:   picoBytes,
		PicoclawPercent: picoPct,
	}
}

func getProcessWorkingSet(handle windows.Handle) uint64 {
	var pmc winProcessMemoryCounters
	pmc.cb = uint32(unsafe.Sizeof(pmc))
	r1, _, _ := procGetProcessMemoryInfo.Call(uintptr(handle), uintptr(unsafe.Pointer(&pmc)), uintptr(pmc.cb))
	if r1 != 0 {
		return uint64(pmc.workingSetSize)
	}
	return 0
}

func getDeviceTemperature() TemperatureState {
	winTempMu.Lock()
	defer winTempMu.Unlock()

	if time.Since(lastWinTempCheck) < 15*time.Second && lastWinTempCheck.After(time.Time{}) {
		return cachedWinTemp
	}

	// Windows ACPI temperature reading via PowerShell WMI
	cmd := utils.LauncherExecCommand("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CurrentTemperature")
	utils.ApplyLauncherProcAttrs(cmd)
	out, err := cmd.Output()
	lastWinTempCheck = time.Now()

	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		var maxKelvin float64
		for _, line := range lines {
			raw := strings.TrimSpace(line)
			if raw == "" {
				continue
			}
			if val, err := strconv.ParseFloat(raw, 64); err == nil && val > 0 {
				if val > maxKelvin {
					maxKelvin = val
				}
			}
		}

		if maxKelvin > 2000 {
			celsius := roundPercent((maxKelvin - 2732.0) / 10.0)
			fahrenheit := roundPercent((celsius * 9.0 / 5.0) + 32.0)
			status := "normal"
			if celsius > 75 {
				status = "hot"
			} else if celsius > 55 {
				status = "warm"
			}
			cachedWinTemp = TemperatureState{
				Celsius:    celsius,
				Fahrenheit: fahrenheit,
				Available:  true,
				Status:     status,
			}
			return cachedWinTemp
		}
	}

	cachedWinTemp = TemperatureState{
		Available: false,
		Status:    "unavailable",
	}
	return cachedWinTemp
}
