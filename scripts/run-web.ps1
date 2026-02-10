$ErrorActionPreference = "Stop"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed. Run scripts/install-deps.ps1 first."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $repoRoot "Risk.Web")

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found. Running npm install..."
    npm install
}

Write-Host "Starting web app (Vite dev server)..."
npm run dev
