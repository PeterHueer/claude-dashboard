# Claude AI Power Tools Dashboard

Local web dashboard for managing Claude Code skills, MCP servers, plugins, and Beads tasks.

## Start

```bash
cd ~/.claude/dashboard
npm install  # first time only
node server.js
```

Open http://127.0.0.1:3000

## Shell alias (add to ~/.zshrc)

```bash
alias cldash='node ~/.claude/dashboard/server.js'
```

Then: `source ~/.zshrc && cldash`

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
