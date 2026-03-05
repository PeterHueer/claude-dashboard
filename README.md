# Claude AI Power Tools Dashboard

Local web dashboard for managing Claude Code skills, MCP servers, plugins, and Beads tasks.

## Prerequisites

- Node.js 18+
- macOS / Linux — bash available natively
- Windows — requires [Git Bash](https://git-scm.com/downloads) or WSL (does **not** work in cmd.exe or PowerShell)

## Install

### macOS / Linux

```bash
bash ~/.claude/dashboard/install.sh
```

### Windows (Git Bash or WSL)

```bash
bash ~/.claude/dashboard/install.sh
```

> Open Git Bash, then run the command above. Make sure Node.js is in your PATH.

The install script:
1. Runs `npm install` to fetch dependencies
2. Makes all scripts executable
3. Optionally opens the dashboard in your browser via `/dashboard` in Claude Code

## Manual controls

```bash
# Start (no-op if already running)
bash ~/.claude/dashboard/scripts/start.sh

# Stop
bash ~/.claude/dashboard/scripts/stop.sh

# Remove auto-start hooks (also stops the server)
bash ~/.claude/dashboard/scripts/remove.sh
```

Open: http://127.0.0.1:7777

## Claude Code command

Use `/dashboard` inside Claude Code to start the server and open the browser automatically.

## Sections

| Section | Description |
|---|---|
| Overview | Stat counts for skills/MCP/plugins + ready beads tasks |
| Skills | All discovered skills grouped by plugin, with copy-invoke buttons |
| MCP Servers | Active MCP server cards showing package and source |
| Plugins | Installed plugins with type badges and remove actions |
| Beads Tasks | Live bd stats + ready/open task lists |

## Terminal Panel

All CLI command output streams to the terminal panel at the bottom. Click "clear" to reset.

## Security

- Server binds to 127.0.0.1 only (not accessible on network)
- /api/exec only allows: `bd ready/stats/list/show/prime` and `claude plugin install/remove`
