[CmdletBinding()]
param(
    [string]$StartupTaskName = "InTalent WhatsApp PM2 Startup Recovery",
    [string]$MonitorTaskName = "InTalent WhatsApp Health Monitor",
    [switch]$RemoveState,
    [switch]$RemoveSettings,
    [switch]$RemovePm2Logrotate
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw "Run PowerShell as Administrator." }

foreach ($taskName in @($StartupTaskName, $MonitorTaskName)) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Removed task: $taskName"
    }
}

$settingsPath = Join-Path $PSScriptRoot "monitor.settings.json"
$settings = $null
if (Test-Path -LiteralPath $settingsPath) {
    try { $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json } catch { }
}

if ($RemovePm2Logrotate) {
    $pm2 = Get-Command pm2.cmd -ErrorAction SilentlyContinue
    if (-not $pm2) { $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue }
    if ($pm2) {
        if ($settings -and $settings.Pm2Home) { $env:PM2_HOME = [string]$settings.Pm2Home }
        & $pm2.Source uninstall pm2-logrotate
    }
}

if ($RemoveState -and $settings -and $settings.StateRoot -and (Test-Path -LiteralPath ([string]$settings.StateRoot))) {
    Remove-Item -LiteralPath ([string]$settings.StateRoot) -Recurse -Force
    Write-Host "Removed monitoring state/log folder: $($settings.StateRoot)"
}
if ($RemoveSettings -and (Test-Path -LiteralPath $settingsPath)) {
    Remove-Item -LiteralPath $settingsPath -Force
    Write-Host "Removed settings file: $settingsPath"
}

Write-Host "Monitoring scheduled tasks were removed." -ForegroundColor Green
