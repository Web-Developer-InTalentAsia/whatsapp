[CmdletBinding()]
param(
    [string]$PackagePath = "",
    [string]$SettingsPath = "",
    [switch]$InstallDependencies,
    [switch]$NoAutoRollback
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "release.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Resolve-ToolPath {
    param($Settings, [string]$PropertyName, [string[]]$Names)
    if ($Settings.PSObject.Properties.Name -contains $PropertyName) {
        $candidate = [string]$Settings.$PropertyName
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "Required command was not found: $($Names -join ', ')"
}

function Write-ReleaseLog {
    param([string]$Message, [string]$Level = "INFO")
    $line = "{0} [{1}] [{2}] {3}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level.ToUpperInvariant(), $script:ReleaseId, $Message
    Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Invoke-External {
    param([string]$FilePath, [string[]]$Arguments, [string]$StepName)
    Write-ReleaseLog "$StepName started: $FilePath $($Arguments -join ' ')"
    $output = & $FilePath @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    if (-not [string]::IsNullOrWhiteSpace($output)) { Write-ReleaseLog ($output.Trim()) "OUTPUT" }
    if ($exitCode -ne 0) { throw "$StepName failed with exit code $exitCode." }
    Write-ReleaseLog "$StepName completed successfully."
}

function Get-FileHashOrBlank {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    return ""
}

function New-SourceSnapshot {
    param([string]$SnapshotPath)
    $staging = Join-Path $SnapshotPath "snapshot-files"
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    $robocopyArgs = @(
        $script:ProjectPath, $staging, "/E", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
        "/XD", "node_modules", ".git", "logs", "backups",
        "/XF", ".env", "*.log"
    )
    & robocopy.exe @robocopyArgs | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Could not create pre-deployment source snapshot. Robocopy exit code: $LASTEXITCODE" }
    $zipPath = Join-Path $SnapshotPath "source.zip"
    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force
    Remove-Item -LiteralPath $staging -Recurse -Force
    return $zipPath
}

function Get-PayloadRoot {
    param([string]$ExtractedPath)
    if ((Test-Path -LiteralPath (Join-Path $ExtractedPath "server.ts")) -or (Test-Path -LiteralPath (Join-Path $ExtractedPath "src"))) { return $ExtractedPath }
    $children = @(Get-ChildItem -LiteralPath $ExtractedPath -Directory)
    if ($children.Count -eq 1 -and ((Test-Path -LiteralPath (Join-Path $children[0].FullName "server.ts")) -or (Test-Path -LiteralPath (Join-Path $children[0].FullName "src")))) {
        return $children[0].FullName
    }
    throw "The release ZIP does not contain server.ts or src at a supported root level."
}

function Apply-OverlayPackage {
    param([string]$ZipPath)
    if ([string]::IsNullOrWhiteSpace($ZipPath)) {
        Write-ReleaseLog "No package was supplied. Deploying the source currently present in the project folder."
        return @()
    }
    if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "Release package was not found: $ZipPath" }
    if ([System.IO.Path]::GetExtension($ZipPath).ToLowerInvariant() -ne ".zip") { throw "Release package must be a ZIP file." }

    $extractRoot = Join-Path $script:WorkRoot "package"
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $extractRoot -Force
    $payloadRoot = Get-PayloadRoot $extractRoot
    $changed = New-Object System.Collections.Generic.List[string]
    $allowedRootNames = @(
        "server.ts", "package.json", "package-lock.json", "index.html", "vite.config.ts", "vite.config.js",
        "tsconfig.json", "tsconfig.node.json", "ecosystem.config.cjs", "ecosystem.config.js"
    )

    foreach ($file in Get-ChildItem -LiteralPath $payloadRoot -Recurse -File) {
        $relative = $file.FullName.Substring($payloadRoot.Length).TrimStart('\', '/')
        $segments = $relative -split '[\\/]'
        $top = $segments[0]
        $allowed = ($top -in @("src", "public")) -or ($segments.Count -eq 1 -and $file.Name -in $allowedRootNames)
        if (-not $allowed) { continue }
        if ($relative -match '(^|[\\/])\.env($|[\\/])|(^|[\\/])node_modules([\\/]|$)|(^|[\\/])dist([\\/]|$)|(^|[\\/])\.git([\\/]|$)') { continue }

        $destination = Join-Path $script:ProjectPath $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $changed.Add($relative) | Out-Null
    }
    if ($changed.Count -eq 0) { throw "No deployable code files were found in the supplied package." }
    Write-ReleaseLog ("Applied {0} code files from package: {1}" -f $changed.Count, $ZipPath)
    return @($changed)
}

function Test-HealthQuick {
    for ($attempt = 1; $attempt -le [int]$script:Settings.HealthAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri ([string]$script:Settings.HealthUrl) -UseBasicParsing -TimeoutSec ([int]$script:Settings.HealthTimeoutSeconds)
            $payload = $response.Content | ConvertFrom-Json
            if ($response.StatusCode -eq 200 -and $payload.ok -eq $true) { return $true }
        } catch { }
        if ($attempt -lt [int]$script:Settings.HealthAttempts) { Start-Sleep -Seconds ([int]$script:Settings.HealthRetryDelaySeconds) }
    }
    return $false
}

function Restore-FromSnapshot {
    param([string]$SnapshotPath)
    Write-ReleaseLog "Automatic rollback started from snapshot: $SnapshotPath" "WARN"
    $sourceZip = Join-Path $SnapshotPath "source.zip"
    if (-not (Test-Path -LiteralPath $sourceZip -PathType Leaf)) { throw "Snapshot source.zip was not found." }
    $restoreRoot = Join-Path $script:WorkRoot "rollback"
    Expand-Archive -LiteralPath $sourceZip -DestinationPath $restoreRoot -Force
    $robocopyArgs = @(
        $restoreRoot, $script:ProjectPath, "/MIR", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP",
        "/XD", "node_modules", ".git", "logs", "backups",
        "/XF", ".env", "*.log"
    )
    & robocopy.exe @robocopyArgs | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Rollback file restoration failed. Robocopy exit code: $LASTEXITCODE" }

    Set-Location -LiteralPath $script:ProjectPath
    Invoke-External $script:NpmPath @("ci") "Rollback dependency restore"
    Invoke-External $script:NpmPath @("run", "build") "Rollback build"
    Invoke-External $script:Pm2Path @("restart", [string]$script:Settings.Pm2ProcessName, "--update-env") "Rollback PM2 restart"
    Invoke-External $script:Pm2Path @("save") "Rollback PM2 save"
    if (-not (Test-HealthQuick)) { throw "Rollback completed, but the health endpoint is still failing." }
    Write-ReleaseLog "Automatic rollback restored a healthy application." "WARN"
}

if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$script:Settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$script:ProjectPath = [string]$script:Settings.ProjectPath
$env:PM2_HOME = [string]$script:Settings.Pm2Home
$script:NpmPath = Resolve-ToolPath $script:Settings "NpmCommandPath" @("npm.cmd", "npm")
$script:Pm2Path = Resolve-ToolPath $script:Settings "Pm2CommandPath" @("pm2.cmd", "pm2")
$script:ReleaseStartedAt = (Get-Date).ToString("o")
$script:ReleaseId = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Path ([string]$script:Settings.StateRoot) -Force | Out-Null
New-Item -ItemType Directory -Path ([string]$script:Settings.ReleaseRoot) -Force | Out-Null
$script:LogPath = Join-Path ([string]$script:Settings.StateRoot) "release.log"
$script:WorkRoot = Join-Path ([string]$script:Settings.StateRoot) ("work-" + $script:ReleaseId)
$snapshotPath = Join-Path ([string]$script:Settings.ReleaseRoot) $script:ReleaseId
$snapshotCreated = $false
New-Item -ItemType Directory -Path $script:WorkRoot -Force | Out-Null
New-Item -ItemType Directory -Path $snapshotPath -Force | Out-Null

$lockPath = Join-Path ([string]$script:Settings.StateRoot) "deployment.lock"
$lockStream = $null
$status = "failed"
$failureMessage = ""
$changedFiles = @()
try {
    $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    $lockStream.SetLength(0)
    $lockWriter = New-Object System.IO.StreamWriter($lockStream)
    $lockWriter.Write("PID=$PID; ReleaseId=$($script:ReleaseId); StartedAt=$((Get-Date).ToString('o'))")
    $lockWriter.Flush()

    Write-ReleaseLog "Safe deployment started."
    foreach ($required in @("package.json", "package-lock.json", "server.ts", "src")) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:ProjectPath $required))) { throw "Required project item was not found: $required" }
    }

    $beforePackageHash = Get-FileHashOrBlank (Join-Path $script:ProjectPath "package.json")
    $beforeLockHash = Get-FileHashOrBlank (Join-Path $script:ProjectPath "package-lock.json")
    $preHealth = Test-HealthQuick
    Write-ReleaseLog "Pre-deployment public health: $preHealth"

    $snapshotZip = New-SourceSnapshot $snapshotPath
    $snapshotCreated = $true
    $snapshotHash = (Get-FileHash -LiteralPath $snapshotZip -Algorithm SHA256).Hash
    Write-ReleaseLog "Pre-deployment snapshot created: $snapshotZip"

    $changedFiles = Apply-OverlayPackage $PackagePath
    $afterPackageHash = Get-FileHashOrBlank (Join-Path $script:ProjectPath "package.json")
    $afterLockHash = Get-FileHashOrBlank (Join-Path $script:ProjectPath "package-lock.json")
    $dependenciesChanged = ($beforePackageHash -ne $afterPackageHash) -or ($beforeLockHash -ne $afterLockHash)

    Set-Location -LiteralPath $script:ProjectPath
    if ($InstallDependencies -or -not (Test-Path -LiteralPath (Join-Path $script:ProjectPath "node_modules")) -or ($dependenciesChanged -and [bool]$script:Settings.RunNpmCiWhenLockChanges)) {
        Invoke-External $script:NpmPath @("ci") "Dependency installation"
    } else {
        Write-ReleaseLog "Dependency installation skipped because package files did not change."
    }

    Invoke-External $script:NpmPath @("run", "lint") "TypeScript validation"
    if (Test-Path -LiteralPath (Join-Path $script:ProjectPath "dist")) { Remove-Item -LiteralPath (Join-Path $script:ProjectPath "dist") -Recurse -Force }
    Invoke-External $script:NpmPath @("run", "build") "Production build"
    foreach ($requiredBuild in @("dist\index.html", "dist\server.cjs")) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:ProjectPath $requiredBuild) -PathType Leaf)) { throw "Build output was not found: $requiredBuild" }
    }

    Invoke-External $script:Pm2Path @("restart", [string]$script:Settings.Pm2ProcessName, "--update-env") "PM2 restart"
    Invoke-External $script:Pm2Path @("save") "PM2 save"

    $smokeScript = Join-Path $PSScriptRoot "Test-IntalentWhatsappSmoke.ps1"
    Write-ReleaseLog "Running post-deployment smoke tests."
    & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $smokeScript -SettingsPath $SettingsPath
    if ($LASTEXITCODE -ne 0) { throw "Post-deployment smoke tests failed." }

    $status = "success"
    Write-ReleaseLog "Safe deployment completed successfully." "SUCCESS"
} catch {
    $failureMessage = $_.Exception.Message
    Write-ReleaseLog "Deployment failed: $failureMessage" "ERROR"
    $autoRollback = [bool]$script:Settings.AutoRollback -and -not $NoAutoRollback -and $snapshotCreated
    if ($autoRollback) {
        try {
            Restore-FromSnapshot $snapshotPath
            $status = "rolled_back"
        } catch {
            $status = "rollback_failed"
            $failureMessage = "$failureMessage | Rollback failure: $($_.Exception.Message)"
            Write-ReleaseLog "Automatic rollback failed: $($_.Exception.Message)" "CRITICAL"
        }
    }
} finally {
    $manifest = [ordered]@{
        releaseId = $script:ReleaseId
        status = $status
        startedAt = $script:ReleaseStartedAt
        completedAt = (Get-Date).ToString("o")
        projectPath = $script:ProjectPath
        packagePath = $PackagePath
        changedFiles = $changedFiles
        failureMessage = $failureMessage
        snapshotPath = $snapshotPath
        snapshotHash = $(if (Test-Path -LiteralPath (Join-Path $snapshotPath "source.zip")) { (Get-FileHash -LiteralPath (Join-Path $snapshotPath "source.zip") -Algorithm SHA256).Hash } else { "" })
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $snapshotPath "manifest.json") -Encoding UTF8
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path ([string]$script:Settings.StateRoot) "last-deployment.json") -Encoding UTF8

    $retention = [int]$script:Settings.SnapshotRetentionCount
    Get-ChildItem -LiteralPath ([string]$script:Settings.ReleaseRoot) -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -Skip $retention |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    if (Test-Path -LiteralPath $script:WorkRoot) { Remove-Item -LiteralPath $script:WorkRoot -Recurse -Force -ErrorAction SilentlyContinue }
    if ($lockStream) { $lockStream.Dispose() }
}

if ($status -eq "success") { exit 0 }
if ($status -eq "rolled_back") { exit 2 }
exit 1
