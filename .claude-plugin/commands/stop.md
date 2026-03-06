---
description: "Stop the Claude Dashboard"
allowed-tools: Bash
---

Detect the OS and run the appropriate stop script:
- macOS / Linux: `bash ~/.claude/dashboard/scripts/stop.sh`
- Windows: `powershell.exe -File "$HOME\.claude\dashboard\scripts\stop.ps1"`

Then tell the user: "Claude Dashboard stopped."
