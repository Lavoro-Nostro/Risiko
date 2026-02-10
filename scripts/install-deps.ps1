param(
    [switch]$SkipDotnetRestore,
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command '$Name'. $InstallHint"
    }
}

Write-Host "[1/4] Checking prerequisites..."
Require-Command -Name "dotnet" -InstallHint "Install .NET SDK 10+."
Require-Command -Name "node" -InstallHint "Install Node.js 20+."
Require-Command -Name "npm" -InstallHint "Install Node.js 20+ (includes npm)."

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not $SkipDotnetRestore) {
    Write-Host "[2/4] Restoring .NET solution..."
    dotnet restore "Risiko.slnx"
}
else {
    Write-Host "[2/4] Skipped .NET restore."
}

if (-not $SkipNpmInstall) {
    Write-Host "[3/4] Installing frontend dependencies..."
    Push-Location "Risk.Web"
    npm install
    Pop-Location
}
else {
    Write-Host "[3/4] Skipped npm install."
}

Write-Host "[4/4] Done. Dependencies are ready."
