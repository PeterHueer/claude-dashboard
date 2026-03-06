---
description: "Open the Claude Dashboard in the browser"
allowed-tools: Bash
---

Detect the OS and run the appropriate start script:
- macOS / Linux: `bash ~/.claude/dashboard/scripts/start.sh`
- Windows: `powershell.exe -File "$HOME\.claude\dashboard\scripts\start.ps1"`

Then tell the user: "Claude Dashboard opened at http://127.0.0.1:7777"
