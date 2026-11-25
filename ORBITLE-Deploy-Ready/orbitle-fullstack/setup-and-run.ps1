$ErrorActionPreference = 'Stop'

Write-Host 'ORBITLE setup' -ForegroundColor Green
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 20+ is required. Install it from https://nodejs.org/ and reopen PowerShell.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  $secret = node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
  (Get-Content '.env' -Raw).Replace('replace-this-with-a-long-random-secret-at-least-32-characters', $secret.Trim()) | Set-Content '.env'
  Write-Host 'Created .env with a random local secret.' -ForegroundColor Green
}

Write-Host 'Installing dependencies (first run may take a few minutes)...' -ForegroundColor Yellow
npm install
Write-Host 'Starting ORBITLE. Keep this window open.' -ForegroundColor Green
npm run dev
