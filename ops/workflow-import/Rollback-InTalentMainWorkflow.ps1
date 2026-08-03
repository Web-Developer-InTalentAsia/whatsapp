param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$ProjectPath = "C:\Users\Administrator\intalent_whatsapp"
)

$ErrorActionPreference = "Stop"
$ProjectPath = (Resolve-Path $ProjectPath).Path
$BackupPath = (Resolve-Path $BackupPath).Path
$RollbackScript = Join-Path $ProjectPath "ops\workflow-import\rollback-intalent-main-workflow.mjs"

if (-not (Test-Path $RollbackScript)) {
  throw "Rollback script not found: $RollbackScript"
}

$env:INTALENT_PROJECT_PATH = $ProjectPath
& node $RollbackScript "--backup=$BackupPath"
if ($LASTEXITCODE -ne 0) {
  throw "Workflow rollback failed with exit code $LASTEXITCODE."
}
