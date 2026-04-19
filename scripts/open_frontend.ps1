param(
  [string]$Url = "http://localhost:3000/chat"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$todoPath = Join-Path $repoRoot "TODO.md"

Write-Host ""
Write-Host "=== TODO (pending) ===" -ForegroundColor Cyan
if (Test-Path $todoPath) {
  $pendingTasks = Get-Content $todoPath | Where-Object { $_ -match '^\s*-\s\[\s\]\s+' }
  if ($pendingTasks.Count -eq 0) {
    Write-Host "All tasks are complete." -ForegroundColor Green
  } else {
    $pendingTasks | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
  }
} else {
  Write-Host "TODO.md not found in repository root." -ForegroundColor Red
}

function Test-FrontendReady {
  param([string]$TargetUrl)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $TargetUrl -Method Get -TimeoutSec 2
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

Write-Host ""
if (Test-FrontendReady -TargetUrl $Url) {
  Write-Host "Frontend already running. Opening $Url" -ForegroundColor Green
  Start-Process $Url
  exit 0
}

Write-Host "Starting frontend server from frontend/ ..." -ForegroundColor Cyan
Start-Process $Url
Set-Location (Join-Path $repoRoot "frontend")
npm run dev
