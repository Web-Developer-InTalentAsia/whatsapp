[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SettingsPath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Read-Settings {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Monitoring settings were not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
}

function Get-Pm2Path {
    param($Settings)
    if ($Settings.PSObject.Properties.Name -contains "Pm2CommandPath" -and -not [string]::IsNullOrWhiteSpace([string]$Settings.Pm2CommandPath) -and (Test-Path -LiteralPath ([string]$Settings.Pm2CommandPath))) {
        return [string]$Settings.Pm2CommandPath
    }
    foreach ($name in @("pm2.cmd", "pm2")) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "PM2 command was not found."
}

function Rotate-MonitorLog {
    param([string]$LogPath, [int]$MaxMb, [int]$RetentionDays)
    if (Test-Path -LiteralPath $LogPath) {
        $file = Get-Item -LiteralPath $LogPath
        if ($file.Length -ge ($MaxMb * 1MB)) {
            $archive = Join-Path $file.DirectoryName ("monitor-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
            Move-Item -LiteralPath $LogPath -Destination $archive -Force
        }
    }
    Get-ChildItem -LiteralPath (Split-Path -Parent $LogPath) -Filter "monitor-*.log" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1 * $RetentionDays) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

function Write-MonitorLog {
    param([string]$Message, [string]$Level = "INFO")
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level.ToUpperInvariant(), $Message
    Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
}

function Write-MonitorEvent {
    param([string]$Message, [string]$EntryType = "Information", [int]$EventId = 1700)
    try {
        Write-EventLog -LogName Application -Source "InTalentWhatsAppMonitor" -EntryType $EntryType -EventId $EventId -Message $Message
    } catch {
        Write-MonitorLog "Windows Event Log write failed: $($_.Exception.Message)" "WARN"
    }
}

function Send-WebhookAlert {
    param([string]$Title, [string]$Message, [string]$Severity)
    $url = [string]$script:Settings.WebhookUrl
    if ([string]::IsNullOrWhiteSpace($url)) { return }
    $body = [ordered]@{
        text = "[$Severity] $Title`n$Message"
        title = $Title
        severity = $Severity
        host = $env:COMPUTERNAME
        process = [string]$script:Settings.Pm2ProcessName
        healthUrl = [string]$script:Settings.HealthUrl
        timestamp = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 4
    try {
        Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15 | Out-Null
        Write-MonitorLog "Webhook alert sent: $Title"
    } catch {
        Write-MonitorLog "Webhook alert failed: $($_.Exception.Message)" "WARN"
    }
}

function Test-Health {
    param([int]$Attempts)
    $lastError = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri ([string]$script:Settings.HealthUrl) -UseBasicParsing -TimeoutSec ([int]$script:Settings.HealthTimeoutSeconds)
            if ($response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)" }
            $payload = $response.Content | ConvertFrom-Json
            if (-not $payload.ok) { throw "Health payload did not contain ok=true." }
            return [pscustomobject]@{ Healthy = $true; Error = $null; Payload = $payload }
        } catch {
            $lastError = $_.Exception.Message
            Write-MonitorLog "Health attempt $attempt/$Attempts failed: $lastError" "WARN"
            if ($attempt -lt $Attempts) { Start-Sleep -Seconds ([int]$script:Settings.HealthRetryDelaySeconds) }
        }
    }
    return [pscustomobject]@{ Healthy = $false; Error = $lastError; Payload = $null }
}

function Invoke-Pm2 {
    param([string[]]$Arguments, [switch]$IgnoreExitCode)
    $output = & $script:Pm2Path @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    if (-not $IgnoreExitCode -and $exitCode -ne 0) {
        throw "PM2 command failed ($exitCode): pm2 $($Arguments -join ' ')`n$output"
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output.Trim() }
}

function Get-Pm2ProcessState {
    try {
        $result = Invoke-Pm2 -Arguments @("jlist") -IgnoreExitCode
        if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) { return "unknown" }
        $start = $result.Output.IndexOf("[")
        if ($start -lt 0) { return "unknown" }
        $json = $result.Output.Substring($start) | ConvertFrom-Json
        $process = $json | Where-Object { $_.name -eq [string]$script:Settings.Pm2ProcessName } | Select-Object -First 1
        if (-not $process) { return "missing" }
        return [string]$process.pm2_env.status
    } catch {
        Write-MonitorLog "Could not read PM2 process state: $($_.Exception.Message)" "WARN"
        return "unknown"
    }
}

function Start-ProcessFromBuild {
    $projectPath = [string]$script:Settings.ProjectPath
    $name = [string]$script:Settings.Pm2ProcessName
    $ecosystemCandidates = @(
        (Join-Path $projectPath "ecosystem.config.cjs"),
        (Join-Path $projectPath "ecosystem.config.js")
    )
    $ecosystem = $ecosystemCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ($ecosystem) {
        Write-MonitorLog "Starting PM2 process from ecosystem file: $ecosystem" "WARN"
        Invoke-Pm2 -Arguments @("start", $ecosystem, "--only", $name, "--update-env") | Out-Null
        return
    }
    $serverFile = Join-Path $projectPath "dist\server.cjs"
    if (-not (Test-Path -LiteralPath $serverFile -PathType Leaf)) {
        throw "Recovery could not find an ecosystem file or $serverFile. Run npm run build."
    }
    Write-MonitorLog "Starting PM2 process from $serverFile" "WARN"
    Invoke-Pm2 -Arguments @("start", $serverFile, "--name", $name, "--cwd", $projectPath, "--time") | Out-Null
}

function Invoke-Recovery {
    $name = [string]$script:Settings.Pm2ProcessName
    $state = Get-Pm2ProcessState
    Write-MonitorLog "Starting controlled recovery. PM2 state: $state" "WARN"
    try {
        if ($state -eq "missing") {
            $resurrect = Invoke-Pm2 -Arguments @("resurrect") -IgnoreExitCode
            Write-MonitorLog "pm2 resurrect exit=$($resurrect.ExitCode): $($resurrect.Output)" "WARN"
        } else {
            $restart = Invoke-Pm2 -Arguments @("restart", $name, "--update-env") -IgnoreExitCode
            Write-MonitorLog "pm2 restart exit=$($restart.ExitCode): $($restart.Output)" "WARN"
        }
        Start-Sleep -Seconds ([int]$script:Settings.RecoveryWaitSeconds)
        $health = Test-Health -Attempts 1
        if ($health.Healthy) {
            Invoke-Pm2 -Arguments @("save") -IgnoreExitCode | Out-Null
            return $true
        }

        Write-MonitorLog "Initial PM2 recovery did not restore health. Trying a build-based start." "WARN"
        Invoke-Pm2 -Arguments @("delete", $name) -IgnoreExitCode | Out-Null
        Start-ProcessFromBuild
        Invoke-Pm2 -Arguments @("save") -IgnoreExitCode | Out-Null
        Start-Sleep -Seconds ([int]$script:Settings.RecoveryWaitSeconds)
        return (Test-Health -Attempts 1).Healthy
    } catch {
        Write-MonitorLog "Recovery failed: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

function Read-State {
    if (-not (Test-Path -LiteralPath $script:StatePath -PathType Leaf)) {
        return [pscustomobject]@{
            LastStatus = "unknown"
            ConsecutiveFailures = 0
            LastAlertAt = $null
            LastRecoveryAt = $null
            LastRestartAt = $null
            LastCheckedAt = $null
            LastError = $null
        }
    }
    try { return (Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json) }
    catch {
        Write-MonitorLog "State file was invalid and will be reset: $($_.Exception.Message)" "WARN"
        Remove-Item -LiteralPath $script:StatePath -Force -ErrorAction SilentlyContinue
        return (Read-State)
    }
}

function Save-State {
    param($State)
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $script:StatePath -Encoding UTF8
}

$script:Settings = Read-Settings -Path $SettingsPath
$env:PM2_HOME = [string]$script:Settings.Pm2Home
$script:Pm2Path = Get-Pm2Path -Settings $script:Settings
$stateRoot = [string]$script:Settings.StateRoot
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$script:LogPath = Join-Path $stateRoot "monitor.log"
$script:StatePath = Join-Path $stateRoot "state.json"
Rotate-MonitorLog -LogPath $script:LogPath -MaxMb ([int]$script:Settings.MaxMonitorLogMb) -RetentionDays ([int]$script:Settings.MonitorLogRetentionDays)

$lockPath = Join-Path $stateRoot "monitor.lock"
$lockStream = $null
try {
    try {
        $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        exit 0
    }

    $state = Read-State
    $health = Test-Health -Attempts ([int]$script:Settings.HealthAttempts)
    $now = Get-Date
    $state.LastCheckedAt = $now.ToString("o")

    if ($health.Healthy) {
        $wasDown = ([string]$state.LastStatus -eq "unhealthy")
        $state.LastStatus = "healthy"
        $state.ConsecutiveFailures = 0
        $state.LastError = $null
        Save-State -State $state
        Write-MonitorLog "Health check passed. PM2 state: $(Get-Pm2ProcessState)."
        if ($wasDown) {
            $message = "The health endpoint is responding again on $env:COMPUTERNAME."
            Write-MonitorEvent -Message $message -EntryType Information -EventId 1702
            Send-WebhookAlert -Title "InTalent WhatsApp recovered" -Message $message -Severity "RECOVERED"
        }
        exit 0
    }

    $state.ConsecutiveFailures = [int]$state.ConsecutiveFailures + 1
    $state.LastError = [string]$health.Error
    $state.LastRestartAt = $now.ToString("o")
    Save-State -State $state
    Write-MonitorLog "Health check failed after retries. Starting recovery. Error: $($health.Error)" "ERROR"

    $recovered = Invoke-Recovery
    if ($recovered) {
        $state.LastStatus = "healthy"
        $state.ConsecutiveFailures = 0
        $state.LastRecoveryAt = (Get-Date).ToString("o")
        $state.LastError = $null
        Save-State -State $state
        $message = "Automatic PM2 recovery restored the application on $env:COMPUTERNAME."
        Write-MonitorEvent -Message $message -EntryType Warning -EventId 1703
        Send-WebhookAlert -Title "InTalent WhatsApp auto-recovered" -Message $message -Severity "RECOVERED"
        Write-MonitorLog $message "WARN"
        exit 0
    }

    $previousStatus = [string]$state.LastStatus
    $state.LastStatus = "unhealthy"
    $shouldAlert = ($previousStatus -ne "unhealthy")
    if (-not $shouldAlert -and $state.LastAlertAt) {
        try {
            $lastAlert = [datetime]::Parse([string]$state.LastAlertAt)
            $shouldAlert = ((Get-Date) - $lastAlert).TotalMinutes -ge [int]$script:Settings.AlertCooldownMinutes
        } catch { $shouldAlert = $true }
    } elseif (-not $state.LastAlertAt) {
        $shouldAlert = $true
    }

    if ($shouldAlert) {
        $state.LastAlertAt = (Get-Date).ToString("o")
        $message = "The application is still DOWN after automatic recovery. Health URL: $($script:Settings.HealthUrl). PM2 state: $(Get-Pm2ProcessState). Error: $($state.LastError)"
        Write-MonitorEvent -Message $message -EntryType Error -EventId 1701
        Send-WebhookAlert -Title "InTalent WhatsApp is DOWN" -Message $message -Severity "CRITICAL"
        Write-MonitorLog $message "ERROR"
    }
    Save-State -State $state
    exit 1
} finally {
    if ($lockStream) { $lockStream.Dispose() }
}
