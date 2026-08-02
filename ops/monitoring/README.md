# InTalent WhatsApp Step 17 Monitoring

This folder adds Windows Server operational monitoring without changing the application source code or database.

Main scripts:

- `Install-IntalentWhatsappMonitoring.ps1` — creates reboot recovery and recurring health-monitor tasks.
- `Monitor-IntalentWhatsapp.ps1` — checks `/api/health`, restarts PM2 when needed, and alerts only on state changes/cooldown.
- `Start-IntalentWhatsappAtBoot.ps1` — runs `pm2 resurrect` after Windows starts and falls back to `dist/server.cjs` or an ecosystem file.
- `Configure-Pm2LogRotation.ps1` — installs/configures `pm2-logrotate`.
- `Show-IntalentWhatsappMonitoringStatus.ps1` — shows health, tasks, PM2, state, and recent monitor logs.
- `Test-IntalentWhatsappAlert.ps1` — tests the Windows Event Log and optional webhook.
- `Uninstall-IntalentWhatsappMonitoring.ps1` — removes scheduled tasks; state/settings are kept unless switches request removal.

The generated `monitor.settings.json` can contain a webhook URL. Treat it as a secret and do not commit it to Git.
