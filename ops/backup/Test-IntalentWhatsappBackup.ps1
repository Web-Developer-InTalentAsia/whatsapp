[CmdletBinding()]
param(
    [string]$SettingsPath = "",
    [string]$BackupPath = "",
    [switch]$DeepDatabaseRestoreTest
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "backup.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "File was not found: $Path" }
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Read-DotEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw ".env was not found: $Path" }
    $result = @{}
    foreach ($raw in Get-Content -LiteralPath $Path -Encoding UTF8) {
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
        if (Test-Path -LiteralPath $candidate) { return $candidate }
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
function Test-Zip([string]$Path) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try { if ($archive.Entries.Count -lt 1) { throw "Source ZIP is empty." } }
    finally { $archive.Dispose() }
}
function Test-Checksums([string]$Folder) {
    $checksumPath = Join-Path $Folder "checksums.sha256"
    if (-not (Test-Path $checksumPath)) { throw "checksums.sha256 is missing." }
    foreach ($line in Get-Content $checksumPath) {
        if (-not $line) { continue }
        if ($line -notmatch '^([a-fA-F0-9]{64})\s{2}(.+)$') { throw "Invalid checksum line: $line" }
        $file = Join-Path $Folder $Matches[2]
        if (-not (Test-Path $file)) { throw "Missing artifact: $($Matches[2])" }
        $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $Matches[1].ToLowerInvariant()) { throw "Checksum mismatch: $($Matches[2])" }
    }
}
function Invoke-Native([string]$Executable, [string[]]$Arguments, [string]$Description) {
    Write-Host $Description
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}

$settings = Read-JsonFile $SettingsPath
$backupRoot = [string]$settings.BackupRoot
$projectPath = [string]$settings.ProjectPath
$pgBinPath = [string]$settings.PgBinPath

if (-not $BackupPath) {
    $latestPath = Join-Path $backupRoot "latest-success.json"
    if (Test-Path $latestPath) {
        $BackupPath = [string](Read-JsonFile $latestPath).backupPath
    }
    else {
        $latest = Get-ChildItem (Join-Path $backupRoot "daily") -Directory | Sort-Object Name -Descending | Select-Object -First 1
        if (-not $latest) { throw "No daily backup was found." }
        $BackupPath = $latest.FullName
    }
}
$BackupPath = [IO.Path]::GetFullPath($BackupPath)
if (-not (Test-Path $BackupPath -PathType Container)) { throw "Backup folder was not found: $BackupPath" }

$manifestPath = Join-Path $BackupPath "manifest.json"
$dbDump = Join-Path $BackupPath "database.dump"
$sourceZip = Join-Path $BackupPath "source.zip"
foreach ($file in @($manifestPath, $dbDump, $sourceZip)) {
    if (-not (Test-Path $file -PathType Leaf)) { throw "Required backup file is missing: $file" }
}

Test-Checksums $BackupPath
Test-Zip $sourceZip
$pgRestore = Resolve-PostgresExecutable "pg_restore" $pgBinPath
Invoke-Native $pgRestore @("--list", $dbDump) "Validating PostgreSQL backup catalog"

$manifest = Read-JsonFile $manifestPath
Write-Host ""
Write-Host "Basic backup validation passed." -ForegroundColor Green
Write-Host "Backup ID: $($manifest.backupId)"
Write-Host "Created: $($manifest.createdAtLocal)"
Write-Host "Path: $BackupPath"

if (-not $DeepDatabaseRestoreTest) { exit 0 }

$envValues = Read-DotEnv (Join-Path $projectPath ".env")
foreach ($key in @("SQL_HOST", "SQL_USER", "SQL_PASSWORD", "SQL_DB_NAME")) {
    if (-not $envValues.ContainsKey($key) -or -not $envValues[$key]) { throw "$key is missing from .env." }
}
$sqlHost = [string]$envValues.SQL_HOST
$sqlPort = if ($envValues.ContainsKey("SQL_PORT") -and $envValues.SQL_PORT) { [string]$envValues.SQL_PORT } else { "5432" }
$adminUser = if ($envValues.ContainsKey("SQL_ADMIN_USER") -and $envValues.SQL_ADMIN_USER) { [string]$envValues.SQL_ADMIN_USER } else { [string]$envValues.SQL_USER }
$adminPassword = if ($envValues.ContainsKey("SQL_ADMIN_PASSWORD") -and $envValues.SQL_ADMIN_PASSWORD) { [string]$envValues.SQL_ADMIN_PASSWORD } else { [string]$envValues.SQL_PASSWORD }
$productionDb = [string]$envValues.SQL_DB_NAME
$testDb = "intalent_restore_test_" + (Get-Date -Format "yyyyMMddHHmmss")
if ($testDb -eq $productionDb) { throw "Safety check failed: test database name matches production." }

$createdb = Resolve-PostgresExecutable "createdb" $pgBinPath
$dropdb = Resolve-PostgresExecutable "dropdb" $pgBinPath
$psql = Resolve-PostgresExecutable "psql" $pgBinPath
$oldPassword = $env:PGPASSWORD
$env:PGPASSWORD = $adminPassword
try {
    Invoke-Native $createdb @("--host=$sqlHost", "--port=$sqlPort", "--username=$adminUser", "--template=template0", "--encoding=UTF8", $testDb) "Creating temporary restore-test database $testDb"
    Invoke-Native $pgRestore @("--host=$sqlHost", "--port=$sqlPort", "--username=$adminUser", "--dbname=$testDb", "--exit-on-error", "--no-owner", "--no-privileges", $dbDump) "Restoring backup into temporary test database"
    $tableCountOutput = & $psql "--host=$sqlHost" "--port=$sqlPort" "--username=$adminUser" "--dbname=$testDb" "--tuples-only" "--no-align" "--command=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect temporary restore-test database." }
    $tableCountText = (($tableCountOutput | Select-Object -Last 1) | Out-String).Trim()
    $tableCount = 0
    if (-not [int]::TryParse($tableCountText, [ref]$tableCount) -or $tableCount -lt 1) {
        throw "Restore-test database contains no public tables."
    }
    Write-Host "Deep restore test passed with $tableCount public tables." -ForegroundColor Green
}
finally {
    try {
        & $psql "--host=$sqlHost" "--port=$sqlPort" "--username=$adminUser" "--dbname=postgres" "--command=SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$testDb' AND pid <> pg_backend_pid();" | Out-Null
        & $dropdb "--host=$sqlHost" "--port=$sqlPort" "--username=$adminUser" "--if-exists" $testDb | Out-Null
    } catch { Write-Warning "Could not automatically remove temporary database $testDb. Remove it manually." }
    $env:PGPASSWORD = $oldPassword
}
