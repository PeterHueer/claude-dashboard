# Stop the Claude Dashboard server on port 7777

$PORT = 7777

$pid = (netstat -ano 2>$null | Select-String ":$PORT ") |
  ForEach-Object { ($_ -split '\s+')[-1] } |
  Select-Object -First 1

if ($pid) {
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}
