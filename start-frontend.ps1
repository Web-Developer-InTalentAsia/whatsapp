# ============================================================
#  AbunthraHR — Frontend Startup Script (No Docker)
#  Runs Next.js dev server via npm run dev
# ============================================================

$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$FRONTEND = Join-Path $ROOT "frontend"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  AbunthraHR Frontend  (Next.js 14)" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host ""

# ── Check Node.js ────────────────────────────────────────────
$nodeVer = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK]   Node.js $nodeVer" -ForegroundColor Green

# ── Install node_modules if missing ──────────────────────────
$nmPath = Join-Path $FRONTEND "node_modules"
if (-not (Test-Path $nmPath)) {
    Write-Host "[INFO] Installing npm packages (first time, this may take a minute)..." -ForegroundColor Yellow
    Set-Location $FRONTEND
    npm install
    Write-Host "[OK]   npm packages installed." -ForegroundColor Green
} else {
    Write-Host "[OK]   node_modules found." -ForegroundColor Green
}

# ── Write frontend .env.local ────────────────────────────────
$envLocal = Join-Path $FRONTEND ".env.local"
@"
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
"@ | Set-Content -Path $envLocal -Encoding UTF8
Write-Host "[OK]   Frontend .env.local written." -ForegroundColor Green

# ── Start Next.js ────────────────────────────────────────────
Write-Host ""
Write-Host "[START] AbunthraHR UI  →  http://localhost:3000" -ForegroundColor Green
Write-Host "        Login page     →  http://localhost:3000/login" -ForegroundColor Cyan
Write-Host ""

Set-Location $FRONTEND
npm run dev
