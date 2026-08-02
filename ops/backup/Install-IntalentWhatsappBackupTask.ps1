[CmdletBinding()]
param(
    [string]$ProjectPath = "C:\Users\Administrator\intalent_whatsapp",
    [string]$BackupRoot = "C:\Backups\intalent_whatsapp",
    [string]$DailyAt = "02:00",
    [string]$TaskName = "InTalent WhatsApp Daily Backup",
    [string]$Pm2ProcessName = "intalent_whatsapp",
    [int]$DailyRetentionDays = 14,
    [int]$WeeklyRetentionWeeks = 8,
    [int]$MonthlyRetentionMonths = 6,
    [string]$PgBinPath = "",
    [string]$SecondaryBackupPath = "",
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

Assert-Administrator

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "Project folder was not found: $ProjectPath" }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath ".env") -PathType Leaf)) { throw ".env was not found in $ProjectPath" }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "package.json") -PathType Leaf)) { throw "package.json was not found in $ProjectPath" }
$projectPrefix = $ProjectPath.TrimEnd("\") + "\"
$backupPrefix = $BackupRoot.TrimEnd("\") + "\"
if ($backupPrefix.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "BackupRoot must be outside ProjectPath to prevent recursive backups."
}

$parsedTime = [timespan]::Zero
if (-not [timespan]::TryParseExact($DailyAt, "hh\:mm", $null, [ref]$parsedTime)) {
    throw "DailyAt must use HH:mm format, for example 02:00."
}
foreach ($value in @($DailyRetentionDays, $WeeklyRetentionWeeks, $MonthlyRetentionMonths)) {
    if ($value -lt 1) { throw "Retention values must be positive integers." }
}

$backupScript = Join-Path $PSScriptRoot "Backup-IntalentWhatsapp.ps1"
if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) { throw "Backup script is missing: $backupScript" }
$settingsPath = Join-Path $PSScriptRoot "backup.settings.json"
if ((Test-Path -LiteralPath $settingsPath) -and -not $Force) {
    throw "$settingsPath already exists. Use -Force only if you intend to replace its settings."
}

$settings = [ordered]@{
    ProjectPath = $ProjectPath
    BackupRoot = $BackupRoot
    Pm2ProcessName = $Pm2ProcessName
    DailyBackupTime = $DailyAt
    DailyRetentionDays = $DailyRetentionDays
    WeeklyRetentionWeeks = $WeeklyRetentionWeeks
    MonthlyRetentionMonths = $MonthlyRetentionMonths
    IncludeEncryptedEnv = $true
    PgBinPath = $PgBinPath
    SecondaryBackupPath = $SecondaryBackupPath
}
$settings | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $settingsPath -Encoding UTF8

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
foreach ($folder in @("daily", "weekly", "monthly", "logs", "_working")) {
    New-Item -ItemType Directory -Path (Join-Path $BackupRoot $folder) -Force | Out-Null
}

# Restrict the local backup root to SYSTEM and Administrators.
& icacls.exe $BackupRoot /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "BUILTIN\Administrators:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not secure backup folder permissions with icacls." }

$taskActionArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -SettingsPath "{1}"' -f $backupScript, $settingsPath
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskActionArguments
$triggerTime = [datetime]::Today.Add($parsedTime)
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $taskSettings -Description "Daily PostgreSQL, application source, and encrypted configuration backup for InTalent WhatsApp." -Force | Out-Null

Write-Host ""
Write-Host "Backup task installed successfully." -ForegroundColor Green
Write-Host "Task name: $TaskName"
Write-Host "Daily time: $DailyAt"
Write-Host "Backup root: $BackupRoot"
Write-Host "Settings: $settingsPath"
Write-Host ""
Write-Host "Run the first backup now with:"
Write-Host "powershell -ExecutionPolicy Bypass -File `"$backupScript`" -SettingsPath `"$settingsPath`""
