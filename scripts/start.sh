#!/usr/bin/env bash
# Start the Claude Dashboard server on port 7777 (no-op if already running)

PORT=7777
DASHBOARD_DIR="$HOME/.claude/dashboard"
LOG_DIR="$DASHBOARD_DIR/logs"
LOG_FILE="$LOG_DIR/server.log"

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$PORT" >/dev/null 2>&1
  else
    netstat -ano 2>/dev/null | grep -q ":$PORT "
  fi
}

open_browser() {
  case "$(uname -s)" in
    Darwin)   open "http://127.0.0.1:$PORT" ;;
    MINGW*|MSYS*|CYGWIN*) start "http://127.0.0.1:$PORT" ;;
    *)        xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true ;;
  esac
}

if port_in_use; then
  open_browser
  exit 0
fi

mkdir -p "$LOG_DIR"

nohup node "$DASHBOARD_DIR/server.js" >> "$LOG_FILE" 2>&1 &
disown
sleep 1
open_browser
