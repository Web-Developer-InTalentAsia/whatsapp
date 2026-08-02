[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SettingsPath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$env:PM2_HOME = [string]$settings.Pm2Home

$pm2Path = $null
if ($settings.PSObject.Properties.Name -contains "Pm2CommandPath" -and (Test-Path -LiteralPath ([string]$settings.Pm2CommandPath))) {
    $pm2Path = [string]$settings.Pm2CommandPath
} else {
    foreach ($name in @("pm2.cmd", "pm2")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { $pm2Path = $command.Source; break }
    }
}
if (-not $pm2Path) { throw "PM2 was not found." }

Write-Host "Installing or confirming pm2-logrotate..."
& $pm2Path install pm2-logrotate
if ($LASTEXITCODE -ne 0) { throw "pm2-logrotate installation failed with exit code $LASTEXITCODE." }

$compress = if ([bool]$settings.Pm2LogCompress) { "true" } else { "false" }
$commands = New-Object System.Collections.Generic.List[object]
$commands.Add([string[]]@("set", "pm2-logrotate:max_size", [string]$settings.Pm2LogMaxSize))
$commands.Add([string[]]@("set", "pm2-logrotate:retain", [string]$settings.Pm2LogRetainDays))
$commands.Add([string[]]@("set", "pm2-logrotate:compress", $compress))
$commands.Add([string[]]@("set", "pm2-logrotate:dateFormat", "YYYY-MM-DD_HH-mm-ss"))
$commands.Add([string[]]@("set", "pm2-logrotate:workerInterval", "30"))
$commands.Add([string[]]@("set", "pm2-logrotate:rotateInterval", [string]$settings.Pm2LogRotateCron))
foreach ($commandArgs in $commands) {
    & $pm2Path @commandArgs
    if ($LASTEXITCODE -ne 0) { throw "PM2 logrotate setting failed: pm2 $($commandArgs -join ' ')" }
}
& $pm2Path save | Out-Null
Write-Host "PM2 log rotation configured successfully." -ForegroundColor Green
