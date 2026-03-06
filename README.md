# Claude AI Power Tools Dashboard

Local web dashboard for managing Claude Code skills, MCP servers, plugins, and agents.

<img src="example.png" alt="Claude AI Power Tools Dashboard" width="800">

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Architecture](#architecture)
- [Scripts](#scripts)
- [Security](#security)

---

## Installation

### Prerequisites

- Node.js 18+
- macOS / Linux — bash available natively
- Windows — PowerShell 5+ (no Git Bash required)

### Install

```bash
npx @peterhueer/claude-dashboard install
```

This will:
1. Copy all files to `~/.claude/dashboard`
2. Install server dependencies
3. Make scripts executable
4. Ask if you want to register the Claude Code plugin (enables `/dashboard:open` and `/dashboard:stop`)

---

## Usage

### Via Claude Code

```
/dashboard:open   — start the server and open the browser
/dashboard:stop   — stop the server
```

### Via terminal

**macOS / Linux**
```bash
bash ~/.claude/dashboard/scripts/start.sh
bash ~/.claude/dashboard/scripts/stop.sh
```

**Windows**
```powershell
powershell -File ~/.claude/dashboard/scripts/start.ps1
powershell -File ~/.claude/dashboard/scripts/stop.ps1
```

Open manually: http://127.0.0.1:7777

---

## Features

- **Overview** — stat cards for all sections, click to navigate
- **Skills** — browse personal and plugin skills across three tabs: My Skills, Plugins, Discover
- **Skill discovery** — search [skills.sh](https://skills.sh) and browse All Time / Trending / Hot; install directly from the dashboard
- **MCP Servers** — view all active MCP server configurations with their source (global or plugin)
- **Plugins** — inspect installed plugins with type badges (skill / mcp)
- **Agents** — explore available agents across all installed plugins
- **Terminal panel** — live CLI output streamed to the browser for every action

---

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Frontend | Vanilla JS, DaisyUI, Tailwind CSS |
| Data | Filesystem scan (no database) |

### Data sources

| Section | Source path |
|---------|------------|
| Skills (personal) | `~/.claude/skills/` |
| Skills (plugins) | `~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/skills/` |
| MCP Servers | `~/.mcp.json`, plugin `.mcp.json` files |
| Plugins | `~/.claude/plugins/marketplaces/` |
| Agents | `~/.claude/plugins/marketplaces/*/plugins/*/agents/` |

### File structure

```
~/.claude/dashboard/
├── server.js              # Express entry point
├── lib/
│   ├── constants.js       # PORT, CLAUDE_DIR, TRASH_DIR
│   └── helpers.js         # Shared utilities
├── routes/
│   ├── discover.js        # GET /api/skills, /api/mcp, /api/plugins, /api/agents
│   ├── mutations.js       # DELETE /api/skills
│   ├── exec.js            # POST /api/exec
│   └── trash.js           # Trash management
├── public/
│   ├── index.html
│   └── js/
│       ├── core.js        # Navigation, API helpers, terminal
│       ├── overview.js
│       ├── skills.js
│       ├── mcp.js
│       ├── plugins.js
│       ├── agents.js
│       └── trash.js
├── scripts/
│   ├── start.sh           # Start server (macOS / Linux)
│   ├── stop.sh            # Stop server (macOS / Linux)
│   ├── start.ps1          # Start server (Windows)
│   ├── stop.ps1           # Stop server (Windows)
│   └── remove.sh          # Remove hooks + stop server
├── bin/
│   └── cli.js             # npx installer
└── .claude-plugin/
    ├── plugin.json        # Plugin manifest
    ├── marketplace.json   # Marketplace manifest
    └── commands/
        ├── open.md        # /dashboard:open
        └── stop.md        # /dashboard:stop
```

---

## Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `scripts/start.sh` | macOS / Linux | Starts server on port 7777, opens browser |
| `scripts/stop.sh` | macOS / Linux | Kills the process on port 7777 |
| `scripts/start.ps1` | Windows | Starts server on port 7777, opens browser |
| `scripts/stop.ps1` | Windows | Kills the process on port 7777 |
| `scripts/remove.sh` | macOS / Linux | Removes dashboard hooks from `~/.claude/settings.json` and stops server |

---

## Security

- Server binds to `127.0.0.1` only — not accessible on the network
- `/api/exec` only allows two command patterns:
  - `claude plugin install/remove <package>`
  - `npx skills add <source>@<skillId>`
- All user input is HTML-escaped before rendering
