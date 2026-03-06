# Start the Claude Dashboard server on port 7777 (no-op if already running)

$PORT = 7777
$DASHBOARD_DIR = "$HOME\.claude\dashboard"
$LOG_DIR = "$DASHBOARD_DIR\logs"
$LOG_FILE = "$LOG_DIR\server.log"

function Port-InUse {
  $connections = netstat -ano 2>$null | Select-String ":$PORT "
  return $connections.Count -gt 0
}

if (Port-InUse) {
  Start-Process "http://127.0.0.1:$PORT"
  exit 0
}

if (-not (Test-Path $LOG_DIR)) {
  New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
}

$proc = Start-Process -FilePath "node" -ArgumentList "$DASHBOARD_DIR\server.js" `
  -RedirectStandardOutput $LOG_FILE -RedirectStandardError $LOG_FILE `
  -WindowStyle Hidden -PassThru

Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:$PORT"
