#Requires -Version 5.1
param(
    [int]$Port = 18800,
    [switch]$NoFrontend,
    [switch]$OpenBrowser,
    [switch]$SkipGatewayBuild
)

$ErrorActionPreference = "Stop"
$Root         = $PSScriptRoot
$WebDir       = Join-Path $Root "web"
$FrontendDir  = Join-Path $WebDir "frontend"
$BuildDir     = Join-Path $Root "build"
$GatewayBin   = Join-Path $BuildDir "picoclaw-dev.exe"
$BackendBin   = Join-Path $BuildDir "backend-dev.exe"
$AirToml      = Join-Path $BuildDir ".air.toml"

Write-Host ""
Write-Host "  PicoClaw Dev Server (Hot-Reload Mode)" -ForegroundColor Cyan
Write-Host "  -----------------------------------------" -ForegroundColor DarkGray

# 1. Locate or install air
$airCmd = Get-Command air -ErrorAction SilentlyContinue
$AirBin = $null
if ($airCmd) { $AirBin = $airCmd.Source }
if (-not $AirBin) {
    $GoPath = [System.Environment]::GetEnvironmentVariable("GOPATH", "User")
    if (-not $GoPath) { $GoPath = Join-Path $env:USERPROFILE "go" }
    $candidate = Join-Path $GoPath "bin\air.exe"
    if (Test-Path $candidate) { $AirBin = $candidate }
}
if (-not $AirBin) {
    Write-Host "  [setup] Installing 'air' for Go hot-reload..." -ForegroundColor Yellow
    & go install github.com/air-verse/air@latest
    if ($LASTEXITCODE -ne 0) { throw "Failed to install air. Run manually: go install github.com/air-verse/air@latest" }
    $AirBin = Join-Path (Join-Path $env:USERPROFILE "go") "bin\air.exe"
    Write-Host "  [setup] air installed OK" -ForegroundColor Green
}

# 2. Detect frontend package manager
$FrontendRunner = $null
if (-not $NoFrontend) {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $FrontendRunner = "pnpm dev"
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        $FrontendRunner = "npm run dev"
    } elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
        $FrontendRunner = "yarn dev"
    } else {
        Write-Warning "Neither pnpm nor npm was found in PATH. Skipping frontend dev server."
    }
}

# 3. Initial gateway binary build
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
if (-not $SkipGatewayBuild -or -not (Test-Path $GatewayBin)) {
    Write-Host "  [build] Compiling picoclaw gateway..." -ForegroundColor Yellow
    $env:CGO_ENABLED = "0"
    & go build -tags "goolm,stdjson" -o $GatewayBin "$Root\cmd\picoclaw"
    if ($LASTEXITCODE -ne 0) { throw "picoclaw gateway build failed" }
    Write-Host "  [build] Gateway ready" -ForegroundColor Green
}

# 4. Generate air config for auto-reloading gateway and backend
$airConfig = @"
root = "."
tmp_dir = "build"

[build]
  cmd = 'cmd /c "go build -tags goolm,stdjson -o build/picoclaw-dev.exe ./cmd/picoclaw && go build -ldflags -X=github.com/sipeed/picoclaw/pkg/config.Version=dev -o build/backend-dev.exe ./web/backend"'
  bin = "build/backend-dev.exe"
  args_bin = ["-console", "-no-browser", "-debug", "-port", "$Port"]
  include_ext = ["go"]
  include_dir = ["pkg", "cmd", "web/backend"]
  exclude_dir = [".git", "web/frontend", "build", "web/.tmp", "dist", "workspace", "docs", "logs"]
  delay = 500
  kill_delay = "1s"
  rerun = false

[log]
  time = true
  main_only = false

[color]
  main = "magenta"
  watcher = "cyan"
  build = "yellow"
  runner = "green"

[misc]
  clean_on_exit = true
"@
[System.IO.File]::WriteAllText($AirToml, $airConfig, [System.Text.Encoding]::UTF8)

# 5. Start backend & gateway with air hot-reload
Write-Host "  [backend] Starting backend + gateway hot-reload..." -ForegroundColor Cyan
$backendCmd = "`$host.UI.RawUI.WindowTitle='PicoClaw Dev - Backend & Gateway'; Set-Location '$Root'; `$env:PICOCLAW_BINARY='$GatewayBin'; `$env:PICOCLAW_DEBUG='true'; `$env:PICOCLAW_LOG_LEVEL='debug'; & '$AirBin' -c '$AirToml'; Read-Host 'Backend stopped. Press Enter to close'"
$backendProc = Start-Process powershell -ArgumentList "-NoProfile", "-Command", $backendCmd -PassThru

# 6. Start frontend if requested
$frontendProc = $null
if ($FrontendRunner) {
    Write-Host "  [frontend] Starting Vite ($FrontendRunner)..." -ForegroundColor Cyan
    $frontendCmd = "`$host.UI.RawUI.WindowTitle='PicoClaw Dev - Frontend'; Set-Location '$FrontendDir'; $FrontendRunner; Read-Host 'Frontend stopped. Press Enter to close'"
    $frontendProc = Start-Process powershell -ArgumentList "-NoProfile", "-Command", $frontendCmd -PassThru
}

# 7. Helper to check if TCP port is accepting connections
function Test-PortOpen([string]$HostName, [int]$PortNum, [int]$TimeoutMs = 500) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $PortNum, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            $client.Close()
            return $false
        }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host "  Waiting for servers to initialize..." -ForegroundColor DarkGray
$backendReady = $false
$frontendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    if (-not $backendReady -and (Test-PortOpen "127.0.0.1" $Port)) {
        $backendReady = $true
    }
    if ($FrontendRunner -and -not $frontendReady -and (Test-PortOpen "localhost" 5173)) {
        $frontendReady = $true
    }
    if ($backendReady -and (-not $FrontendRunner -or $frontendReady)) {
        break
    }
    if ($backendProc.HasExited -or ($frontendProc -and $frontendProc.HasExited)) {
        break
    }
    Start-Sleep -Milliseconds 500
}

Write-Host ""
if ($backendReady) {
    Write-Host "  [OK] Backend & Gateway : http://127.0.0.1:$Port" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Backend is still initializing or stopped (check backend window)" -ForegroundColor Yellow
}

if ($frontendReady) {
    Write-Host "  [OK] Frontend UI (Vite) : http://localhost:5173" -ForegroundColor Green
} elseif ($FrontendRunner) {
    Write-Host "  [WARN] Frontend is still initializing or stopped (check frontend window)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Hot Reload Active:" -ForegroundColor DarkGray
Write-Host "    - Edit any Go file in pkg/, cmd/, or web/backend -> rebuilds in ~1-2s" -ForegroundColor DarkGray
Write-Host "    - Edit any file in web/frontend -> browser updates instantly" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C here to stop all dev processes." -ForegroundColor DarkGray
Write-Host ""

if ($OpenBrowser) {
    if ($frontendReady) {
        Start-Process "http://localhost:5173"
    } elseif ($backendReady) {
        Start-Process "http://127.0.0.1:$Port"
    }
}

# 8. Wait and cleanup
try {
    while (-not $backendProc.HasExited -and ($null -eq $frontendProc -or -not $frontendProc.HasExited)) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "  Stopping dev servers..." -ForegroundColor Yellow

    foreach ($proc in @($backendProc, $frontendProc)) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Get-Process -Name "air" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "picoclaw-dev" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name "backend-dev" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "  Done." -ForegroundColor Green
}
