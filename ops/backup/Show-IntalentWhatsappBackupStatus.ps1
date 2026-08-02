[CmdletBinding()]
param(
    [string]$SettingsPath = "",
    [string]$TaskName = "InTalent WhatsApp Daily Backup"
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "backup.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
if (-not (Test-Path $SettingsPath)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content $SettingsPath -Raw | ConvertFrom-Json
$backupRoot = [string]$settings.BackupRoot

Write-Host "InTalent WhatsApp Backup Status" -ForegroundColor Cyan
Write-Host "Backup root: $backupRoot"

$latestSuccessPath = Join-Path $backupRoot "latest-success.json"
if (Test-Path $latestSuccessPath) {
    $latest = Get-Content $latestSuccessPath -Raw | ConvertFrom-Json
    $completed = [datetime]::Parse([string]$latest.completedAtUtc).ToLocalTime()
    $age = (Get-Date) - $completed
    Write-Host "Latest success: $completed"
    Write-Host "Age: $([math]::Round($age.TotalHours, 1)) hours"
    Write-Host "Path: $($latest.backupPath)"
    Write-Host "Size: $([math]::Round(([double]$latest.totalBytes / 1MB), 2)) MB"
    if ($latest.warnings -and $latest.warnings.Count -gt 0) {
        Write-Warning ("Warnings: " + ($latest.warnings -join "; "))
    }
}
else { Write-Warning "No successful backup status file was found." }

$latestFailurePath = Join-Path $backupRoot "latest-failure.json"
if (Test-Path $latestFailurePath) {
    $failure = Get-Content $latestFailurePath -Raw | ConvertFrom-Json
    Write-Warning "Latest failure: $($failure.failedAtUtc) - $($failure.message)"
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Scheduled task state: $($task.State)"
    Write-Host "Last run: $($info.LastRunTime)"
    Write-Host "Last result: $($info.LastTaskResult)"
    Write-Host "Next run: $($info.NextRunTime)"
}
else { Write-Warning "Scheduled task was not found: $TaskName" }
