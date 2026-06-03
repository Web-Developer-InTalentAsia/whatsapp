# ============================================================
#  AbunthraHR — Backend Startup Script (No Docker)
#  Runs FastAPI via uvicorn using local Python venv
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$VENV_PYTHON = Join-Path $BACKEND ".venv\Scripts\python.exe"
$VENV_PIP    = Join-Path $BACKEND ".venv\Scripts\pip.exe"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  AbunthraHR Backend  (FastAPI + uvicorn)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# ── Ensure venv exists ──────────────────────────────────────
if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "[INFO] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv (Join-Path $BACKEND ".venv")
    Write-Host "[OK]   venv created." -ForegroundColor Green
}

# ── Install / upgrade dependencies ──────────────────────────
Write-Host "[INFO] Installing Python dependencies..." -ForegroundColor Yellow
& $VENV_PIP install -r (Join-Path $BACKEND "requirements.txt") --quiet
Write-Host "[OK]   Dependencies ready." -ForegroundColor Green

# ── Check Redis ──────────────────────────────────────────────
$redisSvc = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisSvc -and $redisSvc.Status -ne "Running") {
    Write-Host "[INFO] Starting Redis service..." -ForegroundColor Yellow
    Start-Service -Name "Redis"
}
$redisPing = & "C:\Program Files\Redis\redis-cli.exe" ping 2>&1
if ($redisPing -eq "PONG") {
    Write-Host "[OK]   Redis is running on localhost:6379" -ForegroundColor Green
} else {
    Write-Host "[WARN] Redis not responding — Celery tasks will fail, but API will still work." -ForegroundColor Yellow
}

# ── Check PostgreSQL ─────────────────────────────────────────
$env:PGPASSWORD = "Admin@123"
$pgCheck = & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U abunthrahr -d abunthrahr -c "SELECT 1;" 2>&1
if ($pgCheck -match "1 row") {
    Write-Host "[OK]   PostgreSQL connected (abunthrahr@localhost:5432)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] PostgreSQL connection failed!" -ForegroundColor Red
    Write-Host "        Make sure PostgreSQL is running and user/db 'abunthrahr' exists." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Start uvicorn ────────────────────────────────────────────
Write-Host ""
Write-Host "[START] AbunthraHR API  →  http://localhost:8000" -ForegroundColor Green
Write-Host "        API Docs        →  http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host "        Health check    →  http://localhost:8000/health" -ForegroundColor Cyan
Write-Host ""

Set-Location $BACKEND
& $VENV_PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
