[CmdletBinding()]
param(
    [string]$ProjectPath = "C:\Users\Administrator\intalent_whatsapp",
    [string]$HealthUrl = "https://hrm.intalent.asia/api/health",
    [string]$Pm2ProcessName = "intalent_whatsapp",
    [string]$Pm2Home = "C:\Users\Administrator\.pm2",
    [int]$MonitorIntervalMinutes = 5,
    [int]$StartupDelaySeconds = 60,
    [string]$WebhookUrl = "",
    [string]$RunAsUser = "",
    [string]$StartupTaskName = "InTalent WhatsApp PM2 Startup Recovery",
    [string]$MonitorTaskName = "InTalent WhatsApp Health Monitor",
    [switch]$UseSystemAccount,
    [switch]$SkipLogRotation,
    [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run PowerShell as Administrator."
    }
}

function Get-Pm2CommandPath {
    foreach ($name in @("pm2.cmd", "pm2")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "PM2 was not found in PATH. Run 'npm install pm2 -g' first."
}

Assert-Administrator

if ($MonitorIntervalMinutes -lt 1) { throw "MonitorIntervalMinutes must be at least 1." }
if ($StartupDelaySeconds -lt 0) { throw "StartupDelaySeconds cannot be negative." }

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$Pm2Home = [System.IO.Path]::GetFullPath($Pm2Home)
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "Project folder was not found: $ProjectPath" }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "package.json") -PathType Leaf)) { throw "package.json was not found in $ProjectPath" }
if (-not [Uri]::IsWellFormedUriString($HealthUrl, [UriKind]::Absolute)) { throw "HealthUrl must be an absolute HTTP/HTTPS URL." }

$pm2Path = Get-Pm2CommandPath
$settingsPath = Join-Path $PSScriptRoot "monitor.settings.json"
$monitorScript = Join-Path $PSScriptRoot "Monitor-IntalentWhatsapp.ps1"
$startupScript = Join-Path $PSScriptRoot "Start-IntalentWhatsappAtBoot.ps1"
$logrotateScript = Join-Path $PSScriptRoot "Configure-Pm2LogRotation.ps1"

foreach ($required in @($monitorScript, $startupScript, $logrotateScript)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required script is missing: $required" }
}
if ((Test-Path -LiteralPath $settingsPath) -and -not $Force) {
    throw "$settingsPath already exists. Use -Force only if you intend to replace the monitoring settings."
}

if ([string]::IsNullOrWhiteSpace($RunAsUser)) {
    $RunAsUser = if ([string]::IsNullOrWhiteSpace($env:USERDOMAIN)) { $env:USERNAME } else { "$env:USERDOMAIN\$env:USERNAME" }
}

$stateRoot = "C:\ProgramData\InTalentWhatsAppMonitor"
$settings = [ordered]@{
    ProjectPath = $ProjectPath
    Pm2ProcessName = $Pm2ProcessName
    Pm2Home = $Pm2Home
    Pm2CommandPath = $pm2Path
    HealthUrl = $HealthUrl
    StartupDelaySeconds = $StartupDelaySeconds
    HealthTimeoutSeconds = 15
    HealthAttempts = 3
    HealthRetryDelaySeconds = 5
    RecoveryWaitSeconds = 15
    MonitorIntervalMinutes = $MonitorIntervalMinutes
    AlertCooldownMinutes = 30
    WebhookUrl = $WebhookUrl
    StateRoot = $stateRoot
    MaxMonitorLogMb = 10
    MonitorLogRetentionDays = 30
    EnablePm2Logrotate = (-not $SkipLogRotation)
    Pm2LogMaxSize = "20M"
    Pm2LogRetainDays = 14
    Pm2LogCompress = $true
    Pm2LogRotateCron = "0 0 * * *"
}
$settings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $settingsPath -Encoding UTF8

New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
New-Item -ItemType Directory -Path $Pm2Home -Force | Out-Null

# Limit access to monitoring settings because a webhook URL, when used, is a secret.
& icacls.exe $settingsPath /inheritance:r /grant:r "SYSTEM:F" "BUILTIN\Administrators:F" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Warning "Could not restrict monitor.settings.json permissions with icacls." }
& icacls.exe $stateRoot /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "BUILTIN\Administrators:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Warning "Could not restrict monitoring state folder permissions with icacls." }

$eventSource = "InTalentWhatsAppMonitor"
if (-not [System.Diagnostics.EventLog]::SourceExists($eventSource)) {
    New-EventLog -LogName Application -Source $eventSource
}

$startupArgs = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -SettingsPath "{1}"' -f $startupScript, $settingsPath
$monitorArgs = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -SettingsPath "{1}"' -f $monitorScript, $settingsPath
$startupAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $startupArgs
$monitorAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $monitorArgs
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$monitorTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $MonitorIntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$startupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew
$monitorSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

if ($UseSystemAccount) {
    Write-Warning "SYSTEM mode uses the configured PM2_HOME. Use this only when the PM2 installation and project permissions allow SYSTEM access."
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $StartupTaskName -Action $startupAction -Trigger $startupTrigger -Principal $principal -Settings $startupSettings -Description "Restores the InTalent WhatsApp PM2 process after Windows startup." -Force | Out-Null
    Register-ScheduledTask -TaskName $MonitorTaskName -Action $monitorAction -Trigger $monitorTrigger -Principal $principal -Settings $monitorSettings -Description "Checks the InTalent WhatsApp health endpoint and performs controlled PM2 recovery." -Force | Out-Null
} else {
    Write-Host "Scheduled tasks must run under the same Windows account that owns the PM2 process list." -ForegroundColor Cyan
    Write-Host "Run-as account: $RunAsUser"
    $credential = Get-Credential -UserName $RunAsUser -Message "Enter the Windows password for the PM2 run-as account. The script does not save this password in a file."
    $plainPassword = $credential.GetNetworkCredential().Password
    if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw "A Windows account password is required to create reboot-safe scheduled tasks." }
    Register-ScheduledTask -TaskName $StartupTaskName -Action $startupAction -Trigger $startupTrigger -User $RunAsUser -Password $plainPassword -RunLevel Highest -Settings $startupSettings -Description "Restores the InTalent WhatsApp PM2 process after Windows startup." -Force | Out-Null
    Register-ScheduledTask -TaskName $MonitorTaskName -Action $monitorAction -Trigger $monitorTrigger -User $RunAsUser -Password $plainPassword -RunLevel Highest -Settings $monitorSettings -Description "Checks the InTalent WhatsApp health endpoint and performs controlled PM2 recovery." -Force | Out-Null
    $plainPassword = $null
    $credential = $null
}

$env:PM2_HOME = $Pm2Home
& $pm2Path save | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Warning "'pm2 save' returned a non-zero exit code. Check PM2 manually." }

if (-not $SkipLogRotation) {
    try {
        & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $logrotateScript -SettingsPath $settingsPath
        if ($LASTEXITCODE -ne 0) { Write-Warning "PM2 log rotation configuration returned exit code $LASTEXITCODE." }
    } catch {
        Write-Warning "PM2 log rotation could not be configured automatically: $($_.Exception.Message)"
    }
}

Start-ScheduledTask -TaskName $MonitorTaskName

Write-Host ""
Write-Host "Step 17 monitoring installed successfully." -ForegroundColor Green
Write-Host "Startup task : $StartupTaskName"
Write-Host "Monitor task : $MonitorTaskName (every $MonitorIntervalMinutes minutes)"
Write-Host "Settings     : $settingsPath"
Write-Host "State/logs   : $stateRoot"
Write-Host "PM2 home     : $Pm2Home"
Write-Host ""
Write-Host "Check status with:"
Write-Host "powershell -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Show-IntalentWhatsappMonitoringStatus.ps1')`" -SettingsPath `"$settingsPath`""
