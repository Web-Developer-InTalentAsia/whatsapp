[CmdletBinding()]
param(
    [string]$ProjectPath = "C:\Users\Administrator\intalent_whatsapp",
    [string]$Pm2ProcessName = "intalent_whatsapp",
    [string]$Pm2Home = "C:\Users\Administrator\.pm2",
    [string]$HealthUrl = "https://hrm.intalent.asia/api/health",
    [string]$RootUrl = "https://hrm.intalent.asia/",
    [string]$ReleaseRoot = "C:\Backups\intalent_whatsapp\releases",
    [string]$StateRoot = "C:\ProgramData\InTalentWhatsAppRelease"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Resolve-CommandPath {
    param([string[]]$Names)
    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    return ""
}

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    throw "Project path was not found: $ProjectPath"
}
foreach ($required in @("package.json", "server.ts", "src")) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath $required))) {
        throw "Required project item was not found: $required"
    }
}

$npmPath = Resolve-CommandPath @("npm.cmd", "npm")
$pm2Path = Resolve-CommandPath @("pm2.cmd", "pm2")
if ([string]::IsNullOrWhiteSpace($npmPath)) { throw "npm was not found in PATH." }
if ([string]::IsNullOrWhiteSpace($pm2Path)) { throw "PM2 was not found in PATH." }

New-Item -ItemType Directory -Path $ReleaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null

$settings = [ordered]@{
    ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
    Pm2ProcessName = $Pm2ProcessName
    Pm2Home = [System.IO.Path]::GetFullPath($Pm2Home)
    HealthUrl = $HealthUrl.Trim()
    RootUrl = $RootUrl.TrimEnd('/') + '/'
    ReleaseRoot = [System.IO.Path]::GetFullPath($ReleaseRoot)
    StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
    HealthTimeoutSeconds = 15
    HealthAttempts = 6
    HealthRetryDelaySeconds = 5
    SnapshotRetentionCount = 10
    RunNpmCiWhenLockChanges = $true
    AutoRollback = $true
    NpmCommandPath = $npmPath
    Pm2CommandPath = $pm2Path
}

$settingsPath = Join-Path $PSScriptRoot "release.settings.json"
$settings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $settingsPath -Encoding UTF8

Write-Host "Step 18 release tools installed successfully." -ForegroundColor Green
Write-Host "Settings    : $settingsPath"
Write-Host "Project     : $ProjectPath"
Write-Host "Release root: $ReleaseRoot"
Write-Host "State root  : $StateRoot"
Write-Host ""
Write-Host "Next command:" -ForegroundColor Cyan
Write-Host "powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\Test-IntalentWhatsappSmoke.ps1`""
