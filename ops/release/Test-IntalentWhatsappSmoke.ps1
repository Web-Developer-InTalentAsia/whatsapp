[CmdletBinding()]
param(
    [string]$SettingsPath = "",
    [switch]$AsJson
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

function Add-Result {
    param([string]$Name, [bool]$Passed, [string]$Details)
    $script:Results.Add([pscustomobject]@{ name = $Name; passed = $Passed; details = $Details }) | Out-Null
    if (-not $Passed) { $script:AllPassed = $false }
}

function ConvertFrom-CaseSensitiveJson {
    param([Parameter(Mandatory = $true)][string]$Json)
    Add-Type -AssemblyName System.Web.Extensions
    $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength = [int]::MaxValue
    return $serializer.DeserializeObject($Json)
}

if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$env:PM2_HOME = [string]$settings.Pm2Home
$projectPath = [string]$settings.ProjectPath
$pm2Path = Resolve-ToolPath $settings "Pm2CommandPath" @("pm2.cmd", "pm2")
$script:Results = New-Object System.Collections.Generic.List[object]
$script:AllPassed = $true

try {
    $jlistRaw = (& $pm2Path jlist 2>&1 | Out-String).Trim()
    $jsonStart = $jlistRaw.IndexOf("[")
    if ($jsonStart -lt 0) { throw "PM2 jlist did not return JSON." }
    $items = ConvertFrom-CaseSensitiveJson $jlistRaw.Substring($jsonStart)
    $process = $items | Where-Object { [string]$_['name'] -eq [string]$settings.Pm2ProcessName } | Select-Object -First 1
    $status = if ($process -and $process.ContainsKey('pm2_env')) { [string]$process['pm2_env']['status'] } else { "" }
    $online = [bool]($process -and $status -eq "online")
    Add-Result "PM2 process" $online $(if ($process) { $status } else { "process not found" })
} catch {
    Add-Result "PM2 process" $false $_.Exception.Message
}

$healthPassed = $false
$healthDetails = ""
for ($attempt = 1; $attempt -le [int]$settings.HealthAttempts; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri ([string]$settings.HealthUrl) -UseBasicParsing -TimeoutSec ([int]$settings.HealthTimeoutSeconds)
        $payload = $response.Content | ConvertFrom-Json
        if ($response.StatusCode -eq 200 -and $payload.ok -eq $true) {
            $healthPassed = $true
            $healthDetails = "HTTP 200, ok=true"
            break
        }
        $healthDetails = "HTTP $($response.StatusCode), ok=$($payload.ok)"
    } catch {
        $healthDetails = $_.Exception.Message
    }
    if ($attempt -lt [int]$settings.HealthAttempts) { Start-Sleep -Seconds ([int]$settings.HealthRetryDelaySeconds) }
}
Add-Result "Public health endpoint" $healthPassed $healthDetails

try {
    $rootResponse = Invoke-WebRequest -Uri ([string]$settings.RootUrl) -UseBasicParsing -TimeoutSec ([int]$settings.HealthTimeoutSeconds)
    $isHtml = $rootResponse.StatusCode -eq 200 -and $rootResponse.Content -match "(?i)<!doctype html|<html"
    Add-Result "Public web application" $isHtml "HTTP $($rootResponse.StatusCode), HTML=$isHtml"

    if ($isHtml) {
        $assetMatches = [regex]::Matches($rootResponse.Content, '(?:src|href)=["''](?<url>/assets/[^"'']+\.(?:js|css))["'']', 'IgnoreCase')
        if ($assetMatches.Count -gt 0) {
            $assetUrl = ([uri]::new([uri]([string]$settings.RootUrl), $assetMatches[0].Groups['url'].Value)).AbsoluteUri
            $assetResponse = Invoke-WebRequest -Uri $assetUrl -UseBasicParsing -TimeoutSec ([int]$settings.HealthTimeoutSeconds)
            Add-Result "Compiled frontend asset" ($assetResponse.StatusCode -eq 200 -and $assetResponse.Content.Length -gt 0) "HTTP $($assetResponse.StatusCode), bytes=$($assetResponse.Content.Length)"
        } else {
            Add-Result "Compiled frontend asset" $false "No /assets/*.js or /assets/*.css reference was found in the live HTML."
        }
    }
} catch {
    Add-Result "Public web application" $false $_.Exception.Message
}

$distIndex = Join-Path $projectPath "dist\index.html"
$distServer = Join-Path $projectPath "dist\server.cjs"
Add-Result "dist/index.html" (Test-Path -LiteralPath $distIndex -PathType Leaf) $distIndex
Add-Result "dist/server.cjs" (Test-Path -LiteralPath $distServer -PathType Leaf) $distServer

if (Test-Path -LiteralPath $distIndex -PathType Leaf) {
    $indexContent = Get-Content -LiteralPath $distIndex -Raw
    Add-Result "Production HTML references compiled assets" ($indexContent -notmatch '/src/main\.(?:tsx|ts|jsx|js)' -and $indexContent -match '/assets/') "Checked dist/index.html"
}

$envInDist = Get-ChildItem -LiteralPath (Join-Path $projectPath "dist") -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq ".env" } | Select-Object -First 1
Add-Result "No .env inside dist" (-not [bool]$envInDist) $(if ($envInDist) { $envInDist.FullName } else { "No .env file found in dist." })

$summary = [ordered]@{
    passed = $script:AllPassed
    checkedAt = (Get-Date).ToString("o")
    projectPath = $projectPath
    healthUrl = [string]$settings.HealthUrl
    results = $script:Results
}

if ($AsJson) {
    $summary | ConvertTo-Json -Depth 6
} else {
    Write-Host "=== InTalent WhatsApp Smoke Test ===" -ForegroundColor Cyan
    foreach ($result in $script:Results) {
        $label = if ($result.passed) { "PASS" } else { "FAIL" }
        $color = if ($result.passed) { "Green" } else { "Red" }
        Write-Host ("[{0}] {1} - {2}" -f $label, $result.name, $result.details) -ForegroundColor $color
    }
    Write-Host ""
    if ($script:AllPassed) { Write-Host "All smoke tests passed." -ForegroundColor Green }
    else { Write-Host "One or more smoke tests failed." -ForegroundColor Red }
}

if ($script:AllPassed) { exit 0 }
exit 1
