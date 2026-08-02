[CmdletBinding()]
param(
    [string]$SettingsPath = (Join-Path $PSScriptRoot "backup.settings.json"),
    [switch]$SkipRetention
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$script:LogFile = $null
$script:Warnings = New-Object System.Collections.Generic.List[string]

function Write-BackupLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO"
    )
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    if ($script:LogFile) {
        Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
    }
    if ($Level -eq "WARN") {
        $script:Warnings.Add($Message) | Out-Null
    }
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Settings file was not found: $Path"
    }
    return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Read-DotEnv {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw ".env file was not found: $Path"
    }

    $result = @{}
    foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { continue }
        $equalsIndex = $line.IndexOf("=")
        if ($equalsIndex -lt 1) { continue }

        $key = $line.Substring(0, $equalsIndex).Trim()
        $value = $line.Substring($equalsIndex + 1).Trim()
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $result[$key] = $value
    }
    return $result
}

function Get-RequiredSetting {
    param($Object, [string]$Name)
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        throw "Required backup setting '$Name' is missing."
    }
    return [string]$property.Value
}

function Get-OptionalIntSetting {
    param($Object, [string]$Name, [int]$DefaultValue)
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) { return $DefaultValue }
    $value = 0
    if (-not [int]::TryParse([string]$property.Value, [ref]$value) -or $value -lt 1) {
        throw "Backup setting '$Name' must be a positive integer."
    }
    return $value
}

function Resolve-PostgresExecutable {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$PgBinPath
    )

    if (-not [string]::IsNullOrWhiteSpace($PgBinPath)) {
        $explicit = Join-Path $PgBinPath ($Name + ".exe")
        if (Test-Path -LiteralPath $explicit -PathType Leaf) { return $explicit }
        throw "PostgreSQL executable was not found: $explicit"
    }

    $command = Get-Command ($Name + ".exe") -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $postgresRoot = "C:\Program Files\PostgreSQL"
    if (Test-Path -LiteralPath $postgresRoot -PathType Container) {
        $versionDirectories = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue | Sort-Object {
            try { [version]$_.Name } catch { [version]"0.0" }
        } -Descending
        foreach ($versionDirectory in $versionDirectories) {
            $candidate = Join-Path $versionDirectory.FullName ("bin\" + $Name + ".exe")
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
    }
    $pgAdminCandidate = "C:\Program Files\pgAdmin 4\runtime\$Name.exe"
    if (Test-Path -LiteralPath $pgAdminCandidate -PathType Leaf) { return $pgAdminCandidate }
    throw "$Name.exe was not found. Install PostgreSQL client tools or set PgBinPath in backup.settings.json."
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description
    )

    Write-BackupLog "$Description"
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    foreach ($line in $output) {
        if (-not [string]::IsNullOrWhiteSpace([string]$line)) {
            Write-BackupLog ([string]$line)
        }
    }
    if ($exitCode -ne 0) {
        throw "$Description failed with exit code $exitCode."
    }
}

function Protect-FileWithDpapi {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )
    Add-Type -AssemblyName System.Security
    $plainBytes = [System.IO.File]::ReadAllBytes($SourcePath)
    try {
        $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
            $plainBytes,
            $null,
            [System.Security.Cryptography.DataProtectionScope]::LocalMachine
        )
        [System.IO.File]::WriteAllBytes($DestinationPath, $protectedBytes)
    }
    finally {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
}

function Test-ZipArchive {
    param([Parameter(Mandatory = $true)][string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        if ($archive.Entries.Count -lt 1) { throw "Source ZIP is empty." }
    }
    finally {
        $archive.Dispose()
    }
}

function Write-ChecksumFile {
    param(
        [Parameter(Mandatory = $true)][string]$Folder,
        [Parameter(Mandatory = $true)][string]$OutputPath
    )
    $lines = New-Object System.Collections.Generic.List[string]
    Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -ne (Split-Path $OutputPath -Leaf) } | Sort-Object Name | ForEach-Object {
        $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
        $lines.Add(("{0}  {1}" -f $hash.Hash.ToLowerInvariant(), $_.Name)) | Out-Null
    }
    Set-Content -LiteralPath $OutputPath -Value $lines -Encoding ASCII
}

function Test-ChecksumFile {
    param([Parameter(Mandatory = $true)][string]$Folder)
    $checksumPath = Join-Path $Folder "checksums.sha256"
    if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) { throw "checksums.sha256 is missing." }
    foreach ($line in Get-Content -LiteralPath $checksumPath -Encoding ASCII) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -notmatch '^([a-fA-F0-9]{64})\s{2}(.+)$') { throw "Invalid checksum line: $line" }
        $expected = $Matches[1].ToLowerInvariant()
        $name = $Matches[2]
        $file = Join-Path $Folder $name
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Backup artifact is missing: $name" }
        $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw "Checksum mismatch for $name" }
    }
}

function Remove-ExpiredBackupFolders {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][datetime]$Cutoff
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return }
    Get-ChildItem -LiteralPath $Path -Directory -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $Cutoff } | ForEach-Object {
        Write-BackupLog "Removing expired backup: $($_.FullName)"
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

$mutex = New-Object System.Threading.Mutex($false, "Global\InTalentWhatsappBackup")
$mutexAcquired = $false
$workingFolder = $null
$backupRoot = $null
$previousPgPassword = $env:PGPASSWORD

try {
    $mutexAcquired = $mutex.WaitOne(0)
    if (-not $mutexAcquired) { throw "Another InTalent WhatsApp backup is already running." }

    $settings = Read-JsonFile -Path $SettingsPath
    $projectPath = [System.IO.Path]::GetFullPath((Get-RequiredSetting -Object $settings -Name "ProjectPath"))
    $backupRoot = [System.IO.Path]::GetFullPath((Get-RequiredSetting -Object $settings -Name "BackupRoot"))
    $pm2ProcessName = Get-RequiredSetting -Object $settings -Name "Pm2ProcessName"
    $dailyRetentionDays = Get-OptionalIntSetting -Object $settings -Name "DailyRetentionDays" -DefaultValue 14
    $weeklyRetentionWeeks = Get-OptionalIntSetting -Object $settings -Name "WeeklyRetentionWeeks" -DefaultValue 8
    $monthlyRetentionMonths = Get-OptionalIntSetting -Object $settings -Name "MonthlyRetentionMonths" -DefaultValue 6
    $includeEncryptedEnv = $true
    if ($settings.PSObject.Properties["IncludeEncryptedEnv"]) { $includeEncryptedEnv = [bool]$settings.IncludeEncryptedEnv }
    $pgBinPath = ""
    if ($settings.PSObject.Properties["PgBinPath"]) { $pgBinPath = [string]$settings.PgBinPath }
    $secondaryBackupPath = ""
    if ($settings.PSObject.Properties["SecondaryBackupPath"]) { $secondaryBackupPath = [string]$settings.SecondaryBackupPath }

    if (-not (Test-Path -LiteralPath $projectPath -PathType Container)) { throw "Project folder was not found: $projectPath" }
    $projectPrefix = $projectPath.TrimEnd("\") + "\"
    $backupPrefix = $backupRoot.TrimEnd("\") + "\"
    if ($backupPrefix.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "BackupRoot must be outside ProjectPath to prevent recursive backups."
    }
    $envPath = Join-Path $projectPath ".env"
    $envValues = Read-DotEnv -Path $envPath
    foreach ($requiredKey in @("SQL_HOST", "SQL_USER", "SQL_PASSWORD", "SQL_DB_NAME")) {
        if (-not $envValues.ContainsKey($requiredKey) -or [string]::IsNullOrWhiteSpace([string]$envValues[$requiredKey])) {
            throw "$requiredKey is missing from .env."
        }
    }

    $sqlHost = [string]$envValues["SQL_HOST"]
    $sqlUser = [string]$envValues["SQL_USER"]
    $sqlPassword = [string]$envValues["SQL_PASSWORD"]
    $sqlDatabase = [string]$envValues["SQL_DB_NAME"]
    $sqlPort = "5432"
    if ($envValues.ContainsKey("SQL_PORT") -and -not [string]::IsNullOrWhiteSpace([string]$envValues["SQL_PORT"])) {
        $sqlPort = [string]$envValues["SQL_PORT"]
    }

    $pgDump = Resolve-PostgresExecutable -Name "pg_dump" -PgBinPath $pgBinPath
    $pgRestore = Resolve-PostgresExecutable -Name "pg_restore" -PgBinPath $pgBinPath

    foreach ($folderName in @("daily", "weekly", "monthly", "logs", "_working")) {
        New-Item -ItemType Directory -Path (Join-Path $backupRoot $folderName) -Force | Out-Null
    }

    $script:LogFile = Join-Path (Join-Path $backupRoot "logs") ("backup-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
    $backupId = Get-Date -Format "yyyyMMdd_HHmmss"
    $workingFolder = Join-Path (Join-Path $backupRoot "_working") $backupId
    $dailyFolder = Join-Path (Join-Path $backupRoot "daily") $backupId
    New-Item -ItemType Directory -Path $workingFolder -Force | Out-Null

    Write-BackupLog "Starting backup $backupId for project $projectPath"

    $dbDumpPath = Join-Path $workingFolder "database.dump"
    $env:PGPASSWORD = $sqlPassword
    Invoke-NativeCommand -FilePath $pgDump -Arguments @(
        "--host=$sqlHost",
        "--port=$sqlPort",
        "--username=$sqlUser",
        "--dbname=$sqlDatabase",
        "--format=custom",
        "--compress=9",
        "--no-owner",
        "--no-privileges",
        "--file=$dbDumpPath"
    ) -Description "Creating PostgreSQL custom-format backup"

    if (-not (Test-Path -LiteralPath $dbDumpPath -PathType Leaf) -or (Get-Item -LiteralPath $dbDumpPath).Length -lt 1024) {
        throw "Database dump was not created or is unexpectedly small."
    }
    Invoke-NativeCommand -FilePath $pgRestore -Arguments @("--list", $dbDumpPath) -Description "Validating PostgreSQL backup catalog"

    $sourceStage = Join-Path $workingFolder "source_staging"
    New-Item -ItemType Directory -Path $sourceStage -Force | Out-Null
    Write-BackupLog "Copying source files to backup staging area"
    $robocopyArguments = @(
        $projectPath,
        $sourceStage,
        "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
        "/XD", "node_modules", "dist", ".git", "coverage", ".cache", "backups", "_backups",
        "/XF", ".env", "*.log", "*.tmp", "*.bak"
    )
    & robocopy.exe @robocopyArguments | Out-Null
    $robocopyExit = $LASTEXITCODE
    if ($robocopyExit -gt 7) { throw "Robocopy source staging failed with exit code $robocopyExit." }

    $sourceZipPath = Join-Path $workingFolder "source.zip"
    $sourceItems = Get-ChildItem -LiteralPath $sourceStage -Force | ForEach-Object { $_.FullName }
    if (-not $sourceItems) { throw "Source staging folder is empty." }
    Write-BackupLog "Compressing application source"
    Compress-Archive -LiteralPath $sourceItems -DestinationPath $sourceZipPath -CompressionLevel Optimal -Force
    Remove-Item -LiteralPath $sourceStage -Recurse -Force
    Test-ZipArchive -Path $sourceZipPath

    $encryptedEnvPath = $null
    if ($includeEncryptedEnv) {
        $encryptedEnvPath = Join-Path $workingFolder "environment.dpapi"
        Write-BackupLog "Encrypting .env with Windows DPAPI LocalMachine scope"
        Protect-FileWithDpapi -SourcePath $envPath -DestinationPath $encryptedEnvPath
    }

    $packageVersion = $null
    $packagePath = Join-Path $projectPath "package.json"
    if (Test-Path -LiteralPath $packagePath -PathType Leaf) {
        try { $packageVersion = (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version } catch { $packageVersion = $null }
    }

    $artifactList = New-Object System.Collections.Generic.List[object]
    Get-ChildItem -LiteralPath $workingFolder -File | Sort-Object Name | ForEach-Object {
        $artifactList.Add([ordered]@{
            name = $_.Name
            bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }) | Out-Null
    }

    $manifest = [ordered]@{
        formatVersion = 1
        backupId = $backupId
        createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        createdAtLocal = (Get-Date).ToString("o")
        machineName = $env:COMPUTERNAME
        projectPath = $projectPath
        appVersion = $packageVersion
        pm2ProcessName = $pm2ProcessName
        database = [ordered]@{
            host = $sqlHost
            port = $sqlPort
            name = $sqlDatabase
            user = $sqlUser
            format = "PostgreSQL custom"
        }
        encryptedEnvironmentIncluded = [bool]$includeEncryptedEnv
        encryptedEnvironmentScope = if ($includeEncryptedEnv) { "Windows DPAPI LocalMachine; same Windows server only" } else { $null }
        artifacts = $artifactList
    }
    $manifestPath = Join-Path $workingFolder "manifest.json"
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $checksumPath = Join-Path $workingFolder "checksums.sha256"
    Write-ChecksumFile -Folder $workingFolder -OutputPath $checksumPath
    Test-ChecksumFile -Folder $workingFolder

    Write-BackupLog "Finalizing backup at $dailyFolder"
    Move-Item -LiteralPath $workingFolder -Destination $dailyFolder
    $workingFolder = $null

    $now = Get-Date
    if ($now.DayOfWeek -eq [System.DayOfWeek]::Sunday) {
        $weeklyFolder = Join-Path (Join-Path $backupRoot "weekly") $backupId
        Write-BackupLog "Creating weekly retention copy"
        Copy-Item -LiteralPath $dailyFolder -Destination $weeklyFolder -Recurse -Force
    }
    if ($now.Day -eq 1) {
        $monthlyFolder = Join-Path (Join-Path $backupRoot "monthly") $backupId
        Write-BackupLog "Creating monthly retention copy"
        Copy-Item -LiteralPath $dailyFolder -Destination $monthlyFolder -Recurse -Force
    }

    if (-not [string]::IsNullOrWhiteSpace($secondaryBackupPath)) {
        try {
            $secondaryDaily = Join-Path ([System.IO.Path]::GetFullPath($secondaryBackupPath)) "daily"
            New-Item -ItemType Directory -Path $secondaryDaily -Force | Out-Null
            $secondaryTarget = Join-Path $secondaryDaily $backupId
            Write-BackupLog "Copying backup to secondary location: $secondaryTarget"
            Copy-Item -LiteralPath $dailyFolder -Destination $secondaryTarget -Recurse -Force
            if (-not $SkipRetention) {
                Remove-ExpiredBackupFolders -Path $secondaryDaily -Cutoff $now.AddDays(-$dailyRetentionDays)
            }
        }
        catch {
            Write-BackupLog "Secondary backup copy failed: $($_.Exception.Message)" "WARN"
        }
    }

    if (-not $SkipRetention) {
        Remove-ExpiredBackupFolders -Path (Join-Path $backupRoot "daily") -Cutoff $now.AddDays(-$dailyRetentionDays)
        Remove-ExpiredBackupFolders -Path (Join-Path $backupRoot "weekly") -Cutoff $now.AddDays(-7 * $weeklyRetentionWeeks)
        Remove-ExpiredBackupFolders -Path (Join-Path $backupRoot "monthly") -Cutoff $now.AddMonths(-$monthlyRetentionMonths)
    }

    $backupSize = (Get-ChildItem -LiteralPath $dailyFolder -File | Measure-Object -Property Length -Sum).Sum
    $latestSuccess = [ordered]@{
        status = "success"
        backupId = $backupId
        backupPath = $dailyFolder
        completedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        totalBytes = $backupSize
        warnings = @($script:Warnings)
    }
    $latestSuccess | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot "latest-success.json") -Encoding UTF8
    Remove-Item -LiteralPath (Join-Path $backupRoot "latest-failure.json") -Force -ErrorAction SilentlyContinue

    Write-BackupLog "Backup completed successfully. Folder: $dailyFolder"
    exit 0
}
catch {
    $message = $_.Exception.Message
    try {
        if ($script:LogFile) { Write-BackupLog $message "ERROR" } else { Write-Host $message }
        if ($workingFolder -and (Test-Path -LiteralPath $workingFolder)) {
            Remove-Item -LiteralPath $workingFolder -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($backupRoot) {
            $failure = [ordered]@{
                status = "failed"
                failedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
                message = $message
            }
            $failure | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot "latest-failure.json") -Encoding UTF8
        }
    }
    catch { }
    exit 1
}
finally {
    $env:PGPASSWORD = $previousPgPassword
    if ($mutexAcquired) { $mutex.ReleaseMutex() | Out-Null }
    $mutex.Dispose()
}
