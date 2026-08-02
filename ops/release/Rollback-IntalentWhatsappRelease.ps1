[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [string]$ReleaseId = "",
    [string]$SettingsPath = "",
    [switch]$Force
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "release.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Resolve-ToolPath {
    param($Settings, [string]$PropertyName, [string[]]$Names)
    if ($Settings.PSObject.Properties.Name -contains $PropertyName) {
        $candidate = [string]$Settings.$PropertyName
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "Required command was not found: $($Names -join ', ')"
}

function Invoke-External {
    param([string]$FilePath, [string[]]$Arguments, [string]$StepName)
    Write-Host "$StepName..." -ForegroundColor Cyan
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$StepName failed with exit code $LASTEXITCODE." }
}

if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$projectPath = [string]$settings.ProjectPath
$env:PM2_HOME = [string]$settings.Pm2Home
$npmPath = Resolve-ToolPath $settings "NpmCommandPath" @("npm.cmd", "npm")
$pm2Path = Resolve-ToolPath $settings "Pm2CommandPath" @("pm2.cmd", "pm2")

if ([string]::IsNullOrWhiteSpace($ReleaseId)) {
    $snapshot = Get-ChildItem -LiteralPath ([string]$settings.ReleaseRoot) -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "source.zip") } |
        Sort-Object Name -Descending |
        Select-Object -First 1
} else {
    $candidatePath = Join-Path ([string]$settings.ReleaseRoot) $ReleaseId
    $snapshot = if (Test-Path -LiteralPath $candidatePath -PathType Container) { Get-Item -LiteralPath $candidatePath } else { $null }
}
if (-not $snapshot) { throw "A valid release snapshot was not found." }

$sourceZip = Join-Path $snapshot.FullName "source.zip"
$manifestPath = Join-Path $snapshot.FullName "manifest.json"
if (-not (Test-Path -LiteralPath $sourceZip -PathType Leaf)) { throw "Snapshot source.zip was not found." }
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.snapshotHash) {
        $actualHash = (Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256).Hash
        if ($actualHash -ne [string]$manifest.snapshotHash) { throw "Snapshot integrity check failed." }
    }
}

if (-not $Force -and -not $PSCmdlet.ShouldProcess($projectPath, "Restore release snapshot $($snapshot.Name)")) { return }

$restoreRoot = Join-Path ([string]$settings.StateRoot) ("manual-rollback-" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Path $restoreRoot -Force | Out-Null
try {
    Expand-Archive -LiteralPath $sourceZip -DestinationPath $restoreRoot -Force
    & robocopy.exe $restoreRoot $projectPath /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP /XD node_modules .git logs backups /XF .env *.log | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "File restoration failed. Robocopy exit code: $LASTEXITCODE" }

    Set-Location -LiteralPath $projectPath
    Invoke-External $npmPath @("ci") "Restoring dependencies"
    Invoke-External $npmPath @("run", "lint") "Validating restored source"
    Invoke-External $npmPath @("run", "build") "Building restored release"
    Invoke-External $pm2Path @("restart", [string]$settings.Pm2ProcessName, "--update-env") "Restarting PM2"
    Invoke-External $pm2Path @("save") "Saving PM2 process list"

    & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Test-IntalentWhatsappSmoke.ps1") -SettingsPath $SettingsPath
    if ($LASTEXITCODE -ne 0) { throw "Rollback smoke tests failed." }
    Write-Host "Rollback completed successfully from snapshot $($snapshot.Name)." -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $restoreRoot) { Remove-Item -LiteralPath $restoreRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
