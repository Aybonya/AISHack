$ErrorActionPreference = "Continue"
$RootDir = $PSScriptRoot
$BotDir = Join-Path $RootDir "GreenAPI\AISHack"
$PythonDir = Join-Path $BotDir "python"

Write-Host "========================================"
Write-Host "  AISana - Starting all services"
Write-Host "========================================"
Write-Host ""

# 1. Python OpenAI service (port 5001)
Write-Host "[1/3] Starting Python OpenAI service (port 5001)..."
$pythonMain = Join-Path $PythonDir "openai_service.py"
if (Test-Path $pythonMain) {
    Start-Process -FilePath "python" `
        -ArgumentList $pythonMain `
        -WorkingDirectory $PythonDir `
        -WindowStyle Normal
    Start-Sleep -Seconds 2
    Write-Host "  OK - Python service started"
} else {
    Write-Host "  SKIP - openai_service.py not found"
}

# 2. Bot Express API (port 3001)
Write-Host "[2/3] Starting GreenAPI bot (port 3001)..."
$botServer = Join-Path $BotDir "src\server.js"
if (Test-Path $botServer) {
    Start-Process -FilePath "node" `
        -ArgumentList $botServer `
        -WorkingDirectory $BotDir `
        -WindowStyle Normal
    Start-Sleep -Seconds 2
    Write-Host "  OK - Bot started at http://localhost:3001"
    Write-Host "  Webhook: http://localhost:3001/api/integrations/green-api/webhook"
} else {
    Write-Host "  ERROR - src\server.js not found!"
}

# 3. Next.js Dashboard (port 3000)
Write-Host "[3/3] Starting Next.js dashboard (port 3000)..."
Start-Process -FilePath "cmd" `
    -ArgumentList "/k", "npm run dev" `
    -WorkingDirectory $RootDir `
    -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================"
Write-Host "  All services started!"
Write-Host "========================================"
Write-Host ""
Write-Host "  Dashboard:    http://localhost:3000"
Write-Host "  Bot API:      http://localhost:3001"
Write-Host "  Python AI:    http://localhost:5001"
Write-Host ""
Write-Host "  Mode: Live GreenAPI (Firebase)"
Write-Host "  Auto-sync every 15 seconds"
Write-Host ""
Write-Host "  For webhook, run in another terminal:"
Write-Host "  ngrok http 3001"
Write-Host ""
