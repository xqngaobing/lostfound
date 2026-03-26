param(
  [switch]$SkipInstall
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $SkipInstall) {
  Write-Host "Installing dependencies..."
  Push-Location "$root\backend"
  npm install
  Pop-Location

  Push-Location "$root\frontend"
  npm install
  Pop-Location
}

Write-Host "Starting database (docker compose)..."
Push-Location $root
try {
  docker compose up -d
} catch {
  Write-Warning "Docker not available or failed. If you already have a PostgreSQL running, you can ignore this."
}
Pop-Location

Write-Host "Starting backend and frontend..."
Start-Process -WorkingDirectory "$root\backend" -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev"
Start-Process -WorkingDirectory "$root\frontend" -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev"

Write-Host "Done. Frontend: http://localhost:3000  Backend: http://localhost:4000"
