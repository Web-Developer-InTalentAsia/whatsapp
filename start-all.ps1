# ============================================================
#  AbunthraHR — One-Click Launcher (No Docker)
#  Opens backend + frontend in separate terminal windows
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   AbunthraHR  —  Starting All Services  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Ensure Redis is running ────────────────────────────────
$redisSvc = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisSvc) {
    if ($redisSvc.Status -ne "Running") {
        Write-Host "[INFO] Starting Redis Windows service..." -ForegroundColor Yellow
        Start-Service -Name "Redis"
        Start-Sleep -Seconds 2
    }
    Write-Host "[OK]   Redis service running on port 6379" -ForegroundColor Green
} else {
    # Fallback: try starting redis-server directly in background
    $redisExe = "C:\Program Files\Redis\redis-server.exe"
    if (Test-Path $redisExe) {
        Write-Host "[INFO] Starting Redis server..." -ForegroundColor Yellow
        Start-Process -FilePath $redisExe -WindowStyle Minimized
        Start-Sleep -Seconds 2
        Write-Host "[OK]   Redis started" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Redis not found. Install: winget install Redis.Redis" -ForegroundColor Yellow
    }
}

# ── 2. Open Backend in a new terminal window ─────────────────
Write-Host "[INFO] Opening Backend terminal..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $ROOT "start-backend.ps1")
) -WindowStyle Normal

Start-Sleep -Seconds 3

# ── 3. Open Frontend in a new terminal window ────────────────
Write-Host "[INFO] Opening Frontend terminal..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $ROOT "start-frontend.ps1")
) -WindowStyle Normal

# ── 4. Summary ───────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   AbunthraHR is starting up!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API  →  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs     →  http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host "  Frontend UI  →  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Login        →  http://localhost:3000/login" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Redis        →  localhost:6379" -ForegroundColor DarkCyan
Write-Host "  PostgreSQL   →  localhost:5432 (db: abunthrahr)" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Wait ~15 seconds for both servers to fully start." -ForegroundColor Yellow
Write-Host ""

# Open browser after short delay
Start-Sleep -Seconds 10
Start-Process "http://localhost:3000/login"
