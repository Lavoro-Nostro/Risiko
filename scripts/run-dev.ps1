$ErrorActionPreference = "Stop"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet is not installed. Run scripts/install-deps.ps1 first."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed. Run scripts/install-deps.ps1 first."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Starting host and web in separate terminals..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$repoRoot'; dotnet run --project Risk.Host/Risk.Host.csproj"
)

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$repoRoot\\Risk.Web'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
)

Write-Host "Launched."
