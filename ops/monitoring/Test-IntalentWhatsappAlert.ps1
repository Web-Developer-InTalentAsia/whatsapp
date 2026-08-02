[CmdletBinding()]
param(
    [string]$SettingsPath = ""
)

if ([string]::IsNullOrWhiteSpace($SettingsPath)) {
    $SettingsPath = Join-Path $PSScriptRoot "monitor.settings.json"
}

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) { throw "Settings file was not found: $SettingsPath" }
$settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
$message = "Test alert from InTalent WhatsApp monitor on $env:COMPUTERNAME at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')."

try {
    Write-EventLog -LogName Application -Source "InTalentWhatsAppMonitor" -EntryType Information -EventId 1799 -Message $message
    Write-Host "Windows Event Log test was written successfully." -ForegroundColor Green
} catch {
    Write-Warning "Windows Event Log test failed: $($_.Exception.Message)"
}

if ([string]::IsNullOrWhiteSpace([string]$settings.WebhookUrl)) {
    Write-Host "WebhookUrl is blank. Local alert test only." -ForegroundColor Yellow
    exit 0
}

$body = [ordered]@{
    text = "[TEST] InTalent WhatsApp monitoring`n$message"
    title = "InTalent WhatsApp monitoring test"
    severity = "TEST"
    host = $env:COMPUTERNAME
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri ([string]$settings.WebhookUrl) -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15 | Out-Null
Write-Host "Webhook alert test sent successfully." -ForegroundColor Green
