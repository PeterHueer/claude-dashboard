# Claude AI Power Tools Dashboard

Local web dashboard for managing Claude Code skills, MCP servers, plugins, agents, and custom commands.

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
3. Use `/dashboard` in Claude Code to start the server and open the browser

## Manual controls

```bash
# Start (no-op if already running)
bash ~/.claude/dashboard/scripts/start.sh

# Stop
bash ~/.claude/dashboard/scripts/stop.sh

# Stop server and remove any dashboard hooks from ~/.claude/settings.json
bash ~/.claude/dashboard/scripts/remove.sh
```

Open: http://127.0.0.1:7777

## Claude Code command

Use `/dashboard` inside Claude Code to start the server and open the browser automatically.

## Sections

| Section | Description |
|---|---|
| Overview | Stat counts for skills, MCP servers, plugins, agents, and commands |
| Skills | Installed skills grouped by plugin, with discover and copy-invoke buttons |
| MCP Servers | Active MCP server cards showing package and source |
| Plugins | Installed plugins with type badges |
| Agents | Available agents across all plugins |
| Commands | All custom slash commands with descriptions and copy-invoke buttons |

## Terminal Panel

All CLI command output streams to the terminal panel at the bottom. Click "clear" to reset.

## Security

- Server binds to 127.0.0.1 only (not accessible on network)
- `/api/exec` only allows: `claude plugin install/remove`
