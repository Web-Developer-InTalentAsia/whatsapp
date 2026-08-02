[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SettingsPath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$env:PM2_HOME = [string]$settings.Pm2Home
$stateRoot = [string]$settings.StateRoot
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$logPath = Join-Path $stateRoot "startup.log"

function Write-StartupLog {
    param([string]$Message, [string]$Level = "INFO")
    Add-Content -LiteralPath $logPath -Value ("{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message) -Encoding UTF8
}

function Get-Pm2Path {
    if ($settings.PSObject.Properties.Name -contains "Pm2CommandPath" -and (Test-Path -LiteralPath ([string]$settings.Pm2CommandPath))) { return [string]$settings.Pm2CommandPath }
    foreach ($name in @("pm2.cmd", "pm2")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "PM2 was not found."
}

$pm2Path = Get-Pm2Path
$delay = [int]$settings.StartupDelaySeconds
if ($delay -gt 0) {
    Write-StartupLog "Waiting $delay seconds for Windows networking and services."
    Start-Sleep -Seconds $delay
}

try {
    Set-Location -LiteralPath ([string]$settings.ProjectPath)
    Write-StartupLog "Running pm2 resurrect with PM2_HOME=$env:PM2_HOME"
    $output = & $pm2Path resurrect 2>&1 | Out-String
    Write-StartupLog "pm2 resurrect output: $($output.Trim())"

    Start-Sleep -Seconds 10
    $jlist = & $pm2Path jlist 2>&1 | Out-String
    $found = $false
    $start = $jlist.IndexOf("[")
    if ($start -ge 0) {
        try {
            $items = $jlist.Substring($start) | ConvertFrom-Json
            $found = [bool]($items | Where-Object { $_.name -eq [string]$settings.Pm2ProcessName } | Select-Object -First 1)
        } catch {
            Write-StartupLog "Could not parse pm2 jlist: $($_.Exception.Message)" "WARN"
        }
    }

    if (-not $found) {
        $projectPath = [string]$settings.ProjectPath
        $name = [string]$settings.Pm2ProcessName
        $ecosystem = @((Join-Path $projectPath "ecosystem.config.cjs"), (Join-Path $projectPath "ecosystem.config.js")) |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1
        if ($ecosystem) {
            Write-StartupLog "Process was missing. Starting from $ecosystem" "WARN"
            & $pm2Path start $ecosystem --only $name --update-env 2>&1 | ForEach-Object { Write-StartupLog ([string]$_) }
        } else {
            $serverFile = Join-Path $projectPath "dist\server.cjs"
            if (-not (Test-Path -LiteralPath $serverFile -PathType Leaf)) { throw "Could not find $serverFile. Run npm run build before reboot testing." }
            Write-StartupLog "Process was missing. Starting $serverFile" "WARN"
            & $pm2Path start $serverFile --name $name --cwd $projectPath --time 2>&1 | ForEach-Object { Write-StartupLog ([string]$_) }
        }
    }

    & $pm2Path save 2>&1 | ForEach-Object { Write-StartupLog ([string]$_) }
    Write-StartupLog "PM2 startup recovery completed. Running health monitor."
    & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Monitor-IntalentWhatsapp.ps1") -SettingsPath $SettingsPath
    exit $LASTEXITCODE
} catch {
    Write-StartupLog "Startup recovery failed: $($_.Exception.Message)" "ERROR"
    try {
        Write-EventLog -LogName Application -Source "InTalentWhatsAppMonitor" -EntryType Error -EventId 1710 -Message "InTalent WhatsApp startup recovery failed: $($_.Exception.Message)"
    } catch { }
    exit 1
}
