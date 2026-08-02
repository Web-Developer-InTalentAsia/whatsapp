[CmdletBinding()]
param(
    [string]$SettingsPath = ""
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "release.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Continue"
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json

Write-Host "=== InTalent WhatsApp Release Status ===" -ForegroundColor Cyan
Write-Host "Project      : $($settings.ProjectPath)"
Write-Host "Health URL   : $($settings.HealthUrl)"
Write-Host "Release root : $($settings.ReleaseRoot)"
Write-Host "State root   : $($settings.StateRoot)"
Write-Host ""

$lastPath = Join-Path ([string]$settings.StateRoot) "last-deployment.json"
if (Test-Path -LiteralPath $lastPath) {
    Write-Host "Last deployment:" -ForegroundColor Cyan
    Get-Content -LiteralPath $lastPath -Raw | Write-Host
} else {
    Write-Host "No deployment record has been created yet." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Available snapshots:" -ForegroundColor Cyan
Get-ChildItem -LiteralPath ([string]$settings.ReleaseRoot) -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 15 |
    ForEach-Object {
        $manifestPath = Join-Path $_.FullName "manifest.json"
        if (Test-Path -LiteralPath $manifestPath) {
            try {
                $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
                Write-Host ("{0} | {1} | {2}" -f $_.Name, $manifest.status, $manifest.failureMessage)
            } catch {
                Write-Host ("{0} | manifest unreadable" -f $_.Name) -ForegroundColor Yellow
            }
        } else {
            Write-Host ("{0} | snapshot only" -f $_.Name)
        }
    }

$logPath = Join-Path ([string]$settings.StateRoot) "release.log"
if (Test-Path -LiteralPath $logPath) {
    Write-Host ""
    Write-Host "Latest release log entries:" -ForegroundColor Cyan
    Get-Content -LiteralPath $logPath -Tail 40 | ForEach-Object { Write-Host $_ }
}

Write-Host ""
& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Test-IntalentWhatsappSmoke.ps1") -SettingsPath $SettingsPath
exit $LASTEXITCODE
