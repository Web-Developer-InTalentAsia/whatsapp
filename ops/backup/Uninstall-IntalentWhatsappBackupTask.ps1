[CmdletBinding()]
param(
    [string]$TaskName = "InTalent WhatsApp Daily Backup"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "Scheduled task was not found: $TaskName"
    exit 0
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task removed. Existing backup files were not deleted." -ForegroundColor Green
