[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [string]$SettingsPath = "",
    [switch]$RestoreDatabase,
    [switch]$RestoreSource,
    [switch]$RestoreEncryptedEnv,
    [switch]$SkipPreRestoreBackup,
    [switch]$IUnderstandThisWillOverwriteProduction
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "backup.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

if (-not $IUnderstandThisWillOverwriteProduction) {
    throw "Restore was blocked. Re-run with -IUnderstandThisWillOverwriteProduction after reviewing the backup and recovery guide."
}
if (-not ($RestoreDatabase -or $RestoreSource -or $RestoreEncryptedEnv)) {
    throw "Select at least one restore action: -RestoreDatabase, -RestoreSource, or -RestoreEncryptedEnv."
}

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) { throw "File was not found: $Path" }
    Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Read-DotEnv([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) { throw ".env was not found: $Path" }
    $result = @{}
    foreach ($raw in Get-Content $Path -Encoding UTF8) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith("#")) { continue }
        $index = $line.IndexOf("=")
        if ($index -lt 1) { continue }
        $key = $line.Substring(0, $index).Trim()
        $value = $line.Substring($index + 1).Trim()
        if ($value.Length -ge 2 -and ((($value[0] -eq '"') -and ($value[$value.Length - 1] -eq '"')) -or (($value[0] -eq "'") -and ($value[$value.Length - 1] -eq "'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $result[$key] = $value
    }
    $result
}
function Resolve-PostgresExecutable([string]$Name, [string]$PgBinPath) {
    if ($PgBinPath) {
        $candidate = Join-Path $PgBinPath ($Name + ".exe")
        if (Test-Path $candidate) { return $candidate }
        throw "PostgreSQL executable was not found: $candidate"
    }
    $command = Get-Command ($Name + ".exe") -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $postgresRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path $postgresRoot) {
        $versionDirectories = Get-ChildItem $postgresRoot -Directory | Sort-Object {
            try { [version]$_.Name } catch { [version]"0.0" }
        } -Descending
        foreach ($versionDirectory in $versionDirectories) {
            $candidate = Join-Path $versionDirectory.FullName ("bin\" + $Name + ".exe")
            if (Test-Path $candidate) { return $candidate }
        }
    }
    $pgAdmin = "C:\Program Files\pgAdmin 4\runtime\$Name.exe"
    if (Test-Path $pgAdmin) { return $pgAdmin }
    throw "$Name.exe was not found."
}
function Unprotect-DpapiFile([string]$SourcePath, [string]$DestinationPath) {
    Add-Type -AssemblyName System.Security
    $protectedBytes = [IO.File]::ReadAllBytes($SourcePath)
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect($protectedBytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
    try { [IO.File]::WriteAllBytes($DestinationPath, $plainBytes) }
    finally { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
}
function Invoke-Native([string]$Executable, [string[]]$Arguments, [string]$Description) {
    Write-Host $Description
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}

$settings = Read-JsonFile $SettingsPath
$projectPath = [IO.Path]::GetFullPath([string]$settings.ProjectPath)
$pm2ProcessName = [string]$settings.Pm2ProcessName
$pgBinPath = [string]$settings.PgBinPath
$BackupPath = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path $BackupPath -PathType Container)) { throw "Backup folder was not found: $BackupPath" }

$testScript = Join-Path $PSScriptRoot "Test-IntalentWhatsappBackup.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testScript -SettingsPath $SettingsPath -BackupPath $BackupPath
if ($LASTEXITCODE -ne 0) { throw "Backup validation failed. Restore was cancelled." }

if (-not $SkipPreRestoreBackup) {
    $backupScript = Join-Path $PSScriptRoot "Backup-IntalentWhatsapp.ps1"
    Write-Host "Creating a fresh pre-restore backup..."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupScript -SettingsPath $SettingsPath
    if ($LASTEXITCODE -ne 0) { throw "Pre-restore backup failed. Restore was cancelled." }
}

$currentEnvPath = Join-Path $projectPath ".env"
$envValues = Read-DotEnv $currentEnvPath
foreach ($key in @("SQL_HOST", "SQL_USER", "SQL_PASSWORD", "SQL_DB_NAME")) {
    if (-not $envValues.ContainsKey($key) -or -not $envValues[$key]) { throw "$key is missing from current .env." }
}
$sqlHost = [string]$envValues.SQL_HOST
$sqlPort = if ($envValues.ContainsKey("SQL_PORT") -and $envValues.SQL_PORT) { [string]$envValues.SQL_PORT } else { "5432" }
$sqlUser = [string]$envValues.SQL_USER
$sqlPassword = [string]$envValues.SQL_PASSWORD
$adminUser = if ($envValues.ContainsKey("SQL_ADMIN_USER") -and $envValues.SQL_ADMIN_USER) { [string]$envValues.SQL_ADMIN_USER } else { $sqlUser }
$adminPassword = if ($envValues.ContainsKey("SQL_ADMIN_PASSWORD") -and $envValues.SQL_ADMIN_PASSWORD) { [string]$envValues.SQL_ADMIN_PASSWORD } else { $sqlPassword }
$sqlDatabase = [string]$envValues.SQL_DB_NAME

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempRestore = Join-Path $env:TEMP ("intalent_restore_" + $timestamp)
$sourceStaging = Join-Path $tempRestore "source"
$oldProjectPath = $projectPath + "_before_restore_" + $timestamp
$sourceSwapped = $false
$currentEnvBackup = $currentEnvPath + ".before_restore_" + $timestamp
$oldPgPassword = $env:PGPASSWORD
$originalLocation = Get-Location

try {
    New-Item -ItemType Directory -Path $tempRestore -Force | Out-Null

    if ($RestoreSource) {
        $sourceZip = Join-Path $BackupPath "source.zip"
        if (-not (Test-Path $sourceZip)) { throw "source.zip is missing from backup." }
        New-Item -ItemType Directory -Path $sourceStaging -Force | Out-Null
        Expand-Archive -LiteralPath $sourceZip -DestinationPath $sourceStaging -Force

        if ($RestoreEncryptedEnv) {
            $encryptedEnv = Join-Path $BackupPath "environment.dpapi"
            if (-not (Test-Path $encryptedEnv)) { throw "environment.dpapi is missing from backup." }
            Unprotect-DpapiFile $encryptedEnv (Join-Path $sourceStaging ".env")
        }
        else {
            Copy-Item $currentEnvPath (Join-Path $sourceStaging ".env") -Force
        }

        $currentOps = Join-Path $projectPath "ops\backup"
        $stagedOps = Join-Path $sourceStaging "ops\backup"
        if ((Test-Path $currentOps) -and -not (Test-Path $stagedOps)) {
            New-Item -ItemType Directory -Path (Split-Path $stagedOps -Parent) -Force | Out-Null
            Copy-Item $currentOps $stagedOps -Recurse -Force
        }

        Push-Location $sourceStaging
        try {
            Invoke-Native "npm.cmd" @("ci") "Installing restored application dependencies"
            Invoke-Native "npm.cmd" @("run", "lint") "Validating restored source"
            Invoke-Native "npm.cmd" @("run", "build") "Building restored source"
        }
        finally { Pop-Location }
    }

    if ($RestoreEncryptedEnv -and -not $RestoreSource) {
        $encryptedEnv = Join-Path $BackupPath "environment.dpapi"
        if (-not (Test-Path $encryptedEnv)) { throw "environment.dpapi is missing from backup." }
        Copy-Item $currentEnvPath $currentEnvBackup -Force
        Unprotect-DpapiFile $encryptedEnv $currentEnvPath
    }

    Invoke-Native "pm2.cmd" @("stop", $pm2ProcessName) "Stopping PM2 application"

    if ($RestoreSource) {
        Set-Location (Split-Path $projectPath -Parent)
        if (Test-Path $oldProjectPath) { throw "Rollback folder already exists: $oldProjectPath" }
        Move-Item $projectPath $oldProjectPath
        Move-Item $sourceStaging $projectPath
        $sourceSwapped = $true
    }

    if ($RestoreDatabase) {
        $dbDump = Join-Path $BackupPath "database.dump"
        if (-not (Test-Path $dbDump)) { throw "database.dump is missing from backup." }
        $pgRestore = Resolve-PostgresExecutable "pg_restore" $pgBinPath
        $psql = Resolve-PostgresExecutable "psql" $pgBinPath
        $env:PGPASSWORD = $adminPassword
        Invoke-Native $psql @(
            "--host=$sqlHost", "--port=$sqlPort", "--username=$adminUser", "--dbname=postgres",
            "--command=SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$sqlDatabase' AND pid <> pg_backend_pid();"
        ) "Terminating existing application database connections"
        $env:PGPASSWORD = $sqlPassword
        Invoke-Native $pgRestore @(
            "--host=$sqlHost", "--port=$sqlPort", "--username=$sqlUser", "--dbname=$sqlDatabase",
            "--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-privileges", $dbDump
        ) "Restoring production PostgreSQL database"
    }

    Push-Location $projectPath
    try {
        Invoke-Native "pm2.cmd" @("restart", $pm2ProcessName, "--update-env") "Restarting PM2 application"
        & pm2.cmd save | Out-Null
    }
    finally { Pop-Location }

    $healthy = $false
    for ($attempt = 1; $attempt -le 12; $attempt++) {
        Start-Sleep -Seconds 5
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 10
            if ($health.ok -eq $true) { $healthy = $true; break }
        }
        catch { }
    }
    if (-not $healthy) { throw "Application did not pass the local health check after restore." }

    Write-Host "Restore completed successfully." -ForegroundColor Green
    if ($sourceSwapped) { Write-Host "Previous source was preserved at: $oldProjectPath" }
}
catch {
    Write-Error $_.Exception.Message
    if ($sourceSwapped) {
        try {
            & pm2.cmd stop $pm2ProcessName | Out-Null
            $failedProjectPath = $projectPath + "_failed_restore_" + $timestamp
            if (Test-Path $projectPath) { Move-Item $projectPath $failedProjectPath }
            Move-Item $oldProjectPath $projectPath
            Push-Location $projectPath
            try { & pm2.cmd restart $pm2ProcessName --update-env | Out-Null } finally { Pop-Location }
            Write-Warning "Source rollback completed. Failed restored source was preserved at $failedProjectPath"
        }
        catch { Write-Warning "Automatic source rollback failed. Manual recovery is required." }
    }
    elseif (Test-Path $currentEnvBackup) {
        Copy-Item $currentEnvBackup $currentEnvPath -Force
        try { & pm2.cmd restart $pm2ProcessName --update-env | Out-Null } catch { }
    }
    throw
}
finally {
    $env:PGPASSWORD = $oldPgPassword
    if (Test-Path $projectPath) { Set-Location $projectPath } else { Set-Location $originalLocation }
    if (Test-Path $tempRestore) { Remove-Item $tempRestore -Recurse -Force -ErrorAction SilentlyContinue }
}
