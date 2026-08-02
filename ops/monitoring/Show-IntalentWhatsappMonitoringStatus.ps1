[CmdletBinding()]
param(
    [string]$SettingsPath = "",
    [string]$StartupTaskName = "InTalent WhatsApp PM2 Startup Recovery",
    [string]$MonitorTaskName = "InTalent WhatsApp Health Monitor"
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "monitor.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Continue"
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$env:PM2_HOME = [string]$settings.Pm2Home

Write-Host "=== InTalent WhatsApp Monitoring Status ===" -ForegroundColor Cyan
Write-Host "Health URL : $($settings.HealthUrl)"
Write-Host "PM2 process: $($settings.Pm2ProcessName)"
Write-Host "PM2 home   : $($settings.Pm2Home)"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri ([string]$settings.HealthUrl) -UseBasicParsing -TimeoutSec ([int]$settings.HealthTimeoutSeconds)
    $payload = $response.Content | ConvertFrom-Json
    Write-Host "Health      : OK (HTTP $($response.StatusCode), ok=$($payload.ok))" -ForegroundColor Green
} catch {
    Write-Host "Health      : FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

foreach ($taskName in @($StartupTaskName, $MonitorTaskName)) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName
        $info = Get-ScheduledTaskInfo -TaskName $taskName
        Write-Host ""
        Write-Host "Task: $taskName"
        Write-Host "  State      : $($task.State)"
        Write-Host "  Last run   : $($info.LastRunTime)"
        Write-Host "  Last result: $($info.LastTaskResult)"
        Write-Host "  Next run   : $($info.NextRunTime)"
    } catch {
        Write-Host "Task missing: $taskName" -ForegroundColor Yellow
    }
}

$pm2Path = $null
if ($settings.PSObject.Properties.Name -contains "Pm2CommandPath" -and (Test-Path -LiteralPath ([string]$settings.Pm2CommandPath))) { $pm2Path = [string]$settings.Pm2CommandPath }
if (-not $pm2Path) {
    $command = Get-Command pm2.cmd -ErrorAction SilentlyContinue
    if (-not $command) { $command = Get-Command pm2 -ErrorAction SilentlyContinue }
    if ($command) { $pm2Path = $command.Source }
}
if ($pm2Path) {
    Write-Host ""
    Write-Host "PM2 status:"
    & $pm2Path status
} else {
    Write-Host "PM2 command not found." -ForegroundColor Red
}

$statePath = Join-Path ([string]$settings.StateRoot) "state.json"
if (Test-Path -LiteralPath $statePath) {
    Write-Host ""
    Write-Host "Monitor state:"
    Get-Content -LiteralPath $statePath -Raw | Write-Host
}

$logPath = Join-Path ([string]$settings.StateRoot) "monitor.log"
if (Test-Path -LiteralPath $logPath) {
    Write-Host ""
    Write-Host "Latest monitor log entries:"
    Get-Content -LiteralPath $logPath -Tail 25 | ForEach-Object { Write-Host $_ }
}
