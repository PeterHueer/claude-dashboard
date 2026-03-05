#!/usr/bin/env bash
# Stop the Claude Dashboard server on port 7777 (no-op if not running)

if command -v lsof >/dev/null 2>&1; then
  lsof -ti :7777 | xargs kill 2>/dev/null || true
else
  # Windows (Git Bash) fallback
  PID=$(netstat -ano 2>/dev/null | grep ":7777 " | awk '{print $NF}' | head -1)
  [ -n "$PID" ] && taskkill.exe /PID "$PID" /F 2>/dev/null || true
fi
