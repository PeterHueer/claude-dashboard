#!/usr/bin/env bash
# Remove Claude Dashboard auto-start hooks from ~/.claude/settings.json

SETTINGS_FILE="$HOME/.claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "No settings.json found — nothing to remove."
  exit 0
fi

node - <<'EOF'
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(process.env.HOME, '.claude', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const startCmd = 'bash ~/.claude/dashboard/scripts/start.sh';
const stopCmd  = 'bash ~/.claude/dashboard/scripts/stop.sh';

let removed = 0;

for (const event of ['SessionStart', 'Stop']) {
  if (!settings.hooks || !settings.hooks[event]) continue;
  const before = settings.hooks[event].length;
  settings.hooks[event] = settings.hooks[event].filter(
    e => !(e.hooks && e.hooks.some(h => h.command === startCmd || h.command === stopCmd))
  );
  removed += before - settings.hooks[event].length;
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

if (removed > 0) {
  console.log(`Removed ${removed} dashboard hook(s) from ~/.claude/settings.json`);
} else {
  console.log('No dashboard hooks found — nothing to remove.');
}
EOF

# Also stop the server if running
if command -v lsof >/dev/null 2>&1; then
  lsof -ti :7777 | xargs kill 2>/dev/null || true
else
  PID=$(netstat -ano 2>/dev/null | grep ":7777 " | awk '{print $NF}' | head -1)
  [ -n "$PID" ] && taskkill.exe /PID "$PID" /F 2>/dev/null || true
fi
echo "Dashboard stopped (if it was running)."
