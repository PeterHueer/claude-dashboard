#!/usr/bin/env bash
# One-command install for Claude Dashboard
# Usage: bash ~/.claude/dashboard/install.sh

set -e

DASHBOARD_DIR="$HOME/.claude/dashboard"

echo "Installing Claude Dashboard..."

# 1. Install npm dependencies
cd "$DASHBOARD_DIR"
npm install --silent

# 2. Make scripts executable
chmod +x scripts/start.sh scripts/stop.sh scripts/remove.sh

echo ""
echo "Done! Dashboard installed."
echo "Open: http://127.0.0.1:7777"
echo ""
echo "Manual controls:"
echo "  Start:  bash ~/.claude/dashboard/scripts/start.sh"
echo "  Stop:   bash ~/.claude/dashboard/scripts/stop.sh"
echo "  Remove: bash ~/.claude/dashboard/scripts/remove.sh"
echo ""
echo "Use /dashboard in Claude Code to open it anytime."
