# ============================================================
#  start.ps1 — AISHack Launcher
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "         AISHack - Full Launch                 " -ForegroundColor White
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found." -ForegroundColor Red
    exit 1
}

$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $pythonCmd = $cmd
        break
    }
}
if (-not $pythonCmd) {
    Write-Host "[ERROR] Python not found." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] ngrok not found." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Node.js, Python ($pythonCmd), ngrok - all found" -ForegroundColor Green

Write-Host ""
Write-Host "[SETUP] Checking Python dependencies..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r "$ROOT\python\requirements.txt" --quiet
Write-Host "[SETUP] Python dependencies OK" -ForegroundColor Green

if (-not (Test-Path "$ROOT\node_modules")) {
    Write-Host "[SETUP] Installing npm packages..." -ForegroundColor Yellow
    Push-Location $ROOT
    npm install --silent
    Pop-Location
    Write-Host "[SETUP] npm install OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "[STEP 1] Starting ngrok and registering webhook..." -ForegroundColor Cyan
& $pythonCmd "$ROOT\python\ngrok_manager.py"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] ngrok_manager failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[STEP 2] Starting OpenAI Python service (port 5001)..." -ForegroundColor Cyan
$openaiProc = Start-Process `
    -FilePath $pythonCmd `
    -ArgumentList "$ROOT\python\openai_service.py" `
    -PassThru `
    -WindowStyle Normal

Write-Host "[OK] OpenAI service started (PID: $($openaiProc.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[STEP 3] Starting Node.js server..." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Push-Location $ROOT

try {
    & node src/server.js
} finally {
    Write-Host ""
    Write-Host "[STOP] Stopping OpenAI service..." -ForegroundColor Yellow
    if ($openaiProc -and -not $openaiProc.HasExited) {
        Stop-Process -Id $openaiProc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "[STOP] OpenAI service stopped" -ForegroundColor Green
    }
    Pop-Location
    Write-Host "Press Enter to exit..." -ForegroundColor Gray
    Read-Host
}
