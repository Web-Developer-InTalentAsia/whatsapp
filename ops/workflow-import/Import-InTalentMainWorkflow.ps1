param(
  [string]$ProjectPath = "C:\Users\Administrator\intalent_whatsapp",
  [string]$WhatsAppPhone = "",
  [switch]$DryRun,
  [switch]$ForceInsert
)

$ErrorActionPreference = "Stop"
$ProjectPath = (Resolve-Path $ProjectPath).Path
$Importer = Join-Path $ProjectPath "ops\workflow-import\import-intalent-main-workflow.mjs"

if (-not (Test-Path $Importer)) {
  throw "Importer not found: $Importer"
}
if (-not (Test-Path (Join-Path $ProjectPath ".env"))) {
  throw "Project .env file not found: $ProjectPath\.env"
}
if (-not (Test-Path (Join-Path $ProjectPath "node_modules\pg"))) {
  throw "Project dependencies are missing. Run npm ci in $ProjectPath first."
}

$arguments = @($Importer)
if ($WhatsAppPhone) { $arguments += "--phone=$WhatsAppPhone" }
if ($DryRun) { $arguments += "--dry-run=true" }
if ($ForceInsert) { $arguments += "--force-insert=true" }

$env:INTALENT_PROJECT_PATH = $ProjectPath
Write-Host "Running InTalent workflow importer..." -ForegroundColor Cyan
& node @arguments
if ($LASTEXITCODE -ne 0) {
  throw "Workflow import failed with exit code $LASTEXITCODE."
}

Write-Host "" 
Write-Host "Import completed. Refresh Configuration Settings > Workflows Onboarding." -ForegroundColor Green
